# ai-service/main.py
# FastAPI application exposing /moderate and /chat endpoints powered by CrewAI.

import os
import json
import traceback
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()                       # Load .env before importing agents

from crew import ModerationCrew, ChatCrew, AnalystCrew
from tools.supabase_tools import _get_client


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Komently AI Service starting…")
    yield
    print("Komently AI Service shutting down.")


app = FastAPI(
    title="Komently AI Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],            # tighten in production
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
    Run the 3-agent moderation crew:
      1. Fetcher  → retrieves section settings
      2. Manager  → builds a plain-English rulebook
      3. Moderator → evaluates the comment → JSON verdict
    """
    try:
        parent_context = ""
        if req.parent_id:
            parent_context = f"Crucially, fetch the parent comment thread with comment_id '{req.parent_id}' to provide context.\n"

        inputs = {
            "section_id": req.section_id,
            "parent_context": parent_context,
            "comment_body": req.body
        }

        moderation_crew = ModerationCrew()
        result = moderation_crew.crew().kickoff(inputs=inputs)

        # Parse the moderator's JSON output
        raw = str(result).strip()
        # Try to extract JSON from the response
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        try:
            verdict = json.loads(raw)
        except json.JSONDecodeError:
            # Fallback: approve if we can't parse
            verdict = {
                "status": "approved",
                "toxicityScore": 0.0,
                "isSpam": False,
                "reason": "AI output could not be parsed; defaulting to approved.",
            }

        return ModerationVerdict(
            status=verdict.get("status", "approved"),
            action=verdict.get("action", "approve"),
            toxicity_score=float(verdict.get("toxicityScore", 0.0)),
            is_spam=bool(verdict.get("isSpam", False)),
            reason=verdict.get("reason", ""),
            metadata={
                "agents": ["fetcher", "manager", "moderator"],
                "sentiment_score": float(verdict.get("sentimentScore", 0.0)),
                "raw_output": str(result)[:500],
            },
        )

    except Exception as e:
        traceback.print_exc()
        # Fail-safe: approve so we don't block legitimate users
        return ModerationVerdict(
            status="approved",
            toxicity_score=0.0,
            is_spam=False,
            reason=f"Moderation crew error: {str(e)}",
            metadata={"error": str(e)},
        )


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
    Chat interface for section owners — powered by the Manager agent
    with access to all Supabase tools.
    """
    try:
        # Build conversation context
        history_text = ""
        for msg in req.history[-10:]:  # Keep last 10 messages
            role = msg.get("role", "user")
            content = msg.get("content", "")
            history_text += f"\n{role.upper()}: {content}"
            
        # Natively pre-fetch section settings so the Agent has immediate context
        sb = _get_client()
        current_state = "Unable to fetch current state."
        try:
            resp = sb.table("comment_sections").select("settings, status, name").eq("public_id", req.section_id).single().execute()
            if resp.data:
                current_state = json.dumps(resp.data, indent=2)
        except Exception as e:
            print("Chat pre-fetch warning:", e)

        inputs = {
            "section_id": req.section_id,
            "current_state": current_state,
            "history_text": history_text,
            "user_message": req.message
        }
        
        chat_crew = ChatCrew()
        result = str(chat_crew.crew().kickoff(inputs=inputs)).strip()

        # Parse actions from the end of the response
        actions: list[str] = []
        reply = result
        if "ACTIONS:" in result:
            parts = result.rsplit("ACTIONS:", 1)
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

def run_analyst_crew(section_id: str, report_id: str):
    try:
        inputs = {
            "section_id": section_id,
            "report_id": report_id
        }
        analyst_crew = AnalystCrew()
        analyst_crew.crew().kickoff(inputs=inputs)
    except Exception as e:
        traceback.print_exc()

@app.post("/generate-report")
async def generate_report(req: GenerateReportRequest, tasks: BackgroundTasks):
    """
    Trigger the Analyst Agent to generate a 7-day retrospective markdown report.
    Returns 202 Accepted instantly; saves to DB in background.
    """
    tasks.add_task(run_analyst_crew, req.section_id, req.report_id)
    return {"status": "processing", "report_id": req.report_id}

# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
