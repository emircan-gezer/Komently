# ai-service/main.py

import json
import os
import traceback
import uuid
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from langgraph.errors import GraphInterrupt
from pydantic import BaseModel, Field

load_dotenv()

from crew import ChatCrew, AnalystCrew
from graph import komently_app
from tools.mcp_server import fetch_section_settings, update_report_status


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Komently AI Service starting…")
    yield
    print("Komently AI Service shutting down.")


app = FastAPI(title="Komently AI Service", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


# ── /moderate ─────────────────────────────────────────────────────────────────

class ModerateRequest(BaseModel):
    comment_id: str
    section_id: str
    body: str
    parent_id: str | None = None


class ModerationVerdict(BaseModel):
    status: str = "approved"
    action: str = "approved"
    toxicity_score: float = 0.0
    is_spam: bool = False
    reason: str = ""
    metadata: dict = {}


@app.post("/moderate", response_model=ModerationVerdict)
async def moderate_comment(req: ModerateRequest):
    """
    Runs the hierarchical ModerationCrew inside a stateful LangGraph lifecycle:
      moderation → confidence router → retry / deep-review / escalate / auto-approve → finalize

    High-toxicity comments (score > 0.7) pause the graph via interrupt() and return
    a 'flagged' pending-review verdict. Resume via PATCH /moderate/{thread_id}.
    """
    inputs = {
        "input": req.body,
        "section_id": req.section_id,
        "history": [],
        "retry_count": 0,
        "toxicity_score": 0.0,
        "confidence": 1.0,
        "metadata": {
            "origin": "/moderate",
            "comment_id": req.comment_id,
            "parent_id": req.parent_id or "",
        },
    }
    # Each invocation gets its own thread so MemorySaver never replays a previous run
    config = {"configurable": {"thread_id": f"mod_{req.comment_id}_{uuid.uuid4().hex[:8]}"}}

    try:
        output = komently_app.invoke(inputs, config=config)
        verdict = output.get("crew_output", {})
        if isinstance(verdict, str):
            try:
                verdict = json.loads(verdict)
            except json.JSONDecodeError:
                verdict = {}

        return ModerationVerdict(
            status=verdict.get("status", "approved"),
            action=verdict.get("action", "approved"),
            toxicity_score=float(verdict.get("toxicityScore", 0.0)),
            is_spam=bool(verdict.get("isSpam", False)),
            reason=verdict.get("reason", ""),
            metadata={
                "sentiment_score": verdict.get("sentimentScore", 0.0),
                "confidence": verdict.get("confidence", 1.0),
            },
        )

    except GraphInterrupt as gi:
        # Graph paused at escalate_node — comment needs human review.
        # The interrupt payload carries the actual toxicity score from the crew.
        thread_id = config["configurable"]["thread_id"]
        payload = gi.args[0] if gi.args else {}
        actual_toxicity = float(payload.get("toxicity_score", 0.8)) if isinstance(payload, dict) else 0.8
        print(f"[API] Comment escalated for human review | thread={thread_id} | toxicity={actual_toxicity:.2f}")
        return ModerationVerdict(
            status="flagged",
            action="flagged",
            toxicity_score=actual_toxicity,
            is_spam=False,
            reason="High-toxicity comment escalated for human review.",
            metadata={"escalated": True, "pending_thread_id": thread_id},
        )

    except Exception as e:
        traceback.print_exc()
        # Fail-safe: approve so we never silently block legitimate users
        return ModerationVerdict(
            status="approved",
            action="approved",
            toxicity_score=0.0,
            is_spam=False,
            reason=f"Moderation error (fail-safe approve): {str(e)}",
            metadata={"error": str(e)},
        )


# ── /moderate/{thread_id}/resume — human decision resumes escalated graph ─────

class ResumeRequest(BaseModel):
    status: str = Field(description="Moderator decision: 'approved' or 'rejected'")


@app.patch("/moderate/{thread_id}/resume", response_model=ModerationVerdict)
async def resume_moderation(thread_id: str, req: ResumeRequest):
    """
    Resume a graph that was paused at the escalate_node after human review.
    Pass the moderator's decision as { "status": "approved" | "rejected" }.
    """
    if req.status not in ("approved", "rejected", "flagged"):
        raise HTTPException(status_code=400, detail="status must be approved, rejected, or flagged")

    from langgraph.types import Command
    config = {"configurable": {"thread_id": thread_id}}
    try:
        output = komently_app.invoke(Command(resume={"status": req.status}), config=config)
        verdict = output.get("crew_output", {})
        if isinstance(verdict, str):
            verdict = json.loads(verdict) if verdict else {}

        return ModerationVerdict(
            status=verdict.get("status", req.status),
            action=verdict.get("action", req.status),
            toxicity_score=float(verdict.get("toxicityScore", 0.8)),
            is_spam=bool(verdict.get("isSpam", False)),
            reason=verdict.get("reason", f"Human decision: {req.status}"),
            metadata={"resumed_by_human": True},
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ── /chat ─────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    section_id: str
    message: str
    history: list[dict] = Field(default_factory=list)


class ChatResponse(BaseModel):
    reply: str
    actions_taken: list[str] = Field(default_factory=list)


@app.post("/chat", response_model=ChatResponse)
async def chat_with_agent(req: ChatRequest):
    """
    Dashboard chat — calls ChatCrew directly, no LangGraph overhead.
    The manager agent has full tool access and handles the conversation in one pass.
    """
    try:
        # Fetch current section state through the MCP tool so the agent can answer
        # config questions instantly without needing a tool call of its own
        current_state = fetch_section_settings(req.section_id)

        inputs = {
            "section_id": req.section_id,
            "user_message": req.message,
            "current_state": current_state,
            "history_text": "\n".join(
                [f"{m['role']}: {m['content']}" for m in req.history[-5:]]
            ),
        }

        result = ChatCrew().crew().kickoff(inputs=inputs)
        raw = result.raw

        actions: list[str] = []
        reply = raw
        if "ACTIONS:" in raw:
            parts = raw.rsplit("ACTIONS:", 1)
            reply = parts[0].strip()
            try:
                actions = json.loads(parts[1].strip())
            except (json.JSONDecodeError, IndexError):
                actions = []

        return ChatResponse(reply=reply, actions_taken=actions)

    except Exception as e:
        traceback.print_exc()
        return ChatResponse(
            reply=f"Sorry, I had trouble processing that. Error: {str(e)}",
            actions_taken=[],
        )


# ── /generate-report ──────────────────────────────────────────────────────────

class GenerateReportRequest(BaseModel):
    section_id: str
    report_id: str


def _run_analyst(section_id: str, report_id: str):
    try:
        AnalystCrew().crew().kickoff(inputs={
            "section_id": section_id,
            "report_id": report_id,
        })
    except Exception:
        traceback.print_exc()
        # Mark the report as failed so the section isn't permanently blocked
        # from generating future reports (trigger_intel_report checks for "processing" rows)
        try:
            update_report_status(
                report_id=report_id,
                content="Report generation failed. Please try again.",
            )
        except Exception:
            pass


@app.post("/generate-report")
async def generate_report(req: GenerateReportRequest, tasks: BackgroundTasks):
    """
    Triggers AnalystCrew directly as a background task — no graph overhead
    for a linear single-agent job. Returns 202 immediately.
    """
    tasks.add_task(_run_analyst, req.section_id, req.report_id)
    return {"status": "processing", "report_id": req.report_id}


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), reload=True)
