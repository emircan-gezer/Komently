# ai-service/main.py
# FastAPI application exposing /moderate and /chat endpoints powered by CrewAI.

import os
import json
import traceback
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()                       # Load .env before importing agents

from crewai import Agent, Task, Crew, Process
from agents.fetcher import create_fetcher_agent
from agents.manager import create_manager_agent
from agents.moderator import create_moderator_agent


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
        fetcher   = create_fetcher_agent()
        manager   = create_manager_agent()
        moderator = create_moderator_agent()

        # Task 1 — Fetcher retrieves section data
        fetch_task = Task(
            description=(
                f"Fetch the section settings and the 10 most recent comments "
                f"for section_id '{req.section_id}'. Return the raw data as JSON."
            ),
            expected_output="JSON containing section settings and recent comments.",
            agent=fetcher,
        )

        # Task 2 — Manager interprets settings as rules
        manage_task = Task(
            description=(
                "Using the section settings retrieved by the Data Retrieval Specialist, "
                "create a clear, numbered moderation rulebook in plain English. Include "
                "the toxicity threshold, character limits, blacklisted words, and any "
                "other active policies."
            ),
            expected_output="A numbered plain-English moderation rulebook.",
            agent=manager,
            context=[fetch_task],
        )

        # Task 3 — Moderator evaluates the comment
        moderate_task = Task(
            description=(
                f"Evaluate the following comment against the moderation rulebook:\n\n"
                f"---\n{req.body}\n---\n\n"
                "Decide on an action and status based on these thresholds:\n"
                "- toxicityScore > 0.85 OR isSpam is true: action='rejected', status='rejected'\n"
                "- toxicityScore between 0.6 and 0.85: action='flagged', status='flagged'\n"
                "- toxicityScore between 0.4 and 0.6 OR borderline spammy: action='shadow_hidden', status='shadow_hidden'\n"
                "- toxicityScore < 0.4: action='approved', status='approved'\n\n"
                "Output ONLY a JSON object with these exact keys:\n"
                '  "status": "approved", "flagged", "rejected", or "shadow_hidden",\n'
                '  "action": "approved", "flagged", "rejected", or "shadow_hidden",\n'
                '  "toxicityScore": float 0.0-1.0,\n'
                '  "isSpam": true or false,\n'
                '  "reason": brief explanation string\n'
                "Do NOT add any text outside the JSON."
            ),
            expected_output='JSON object: {"status":"...","action":"...","toxicityScore":...,"isSpam":...,"reason":"..."}',
            agent=moderator,
            context=[manage_task],
        )

        crew = Crew(
            agents=[fetcher, manager, moderator],
            tasks=[fetch_task, manage_task, moderate_task],
            process=Process.sequential,
            verbose=True,
        )

        result = crew.kickoff()

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
        manager = create_manager_agent()

        # Build conversation context
        history_text = ""
        for msg in req.history[-10:]:  # Keep last 10 messages
            role = msg.get("role", "user")
            content = msg.get("content", "")
            history_text += f"\n{role.upper()}: {content}"

        chat_task = Task(
            description=(
                f"You are helping the owner of comment section '{req.section_id}' "
                f"manage their community. You have tools to fetch settings, "
                f"fetch recent comments, update comment statuses, and update section settings.\n\n"
                f"CONVERSATION HISTORY:{history_text}\n\n"
                f"USER'S LATEST MESSAGE: {req.message}\n\n"
                "Respond helpfully. If the user asks you to change settings or "
                "moderate comments, use your tools and confirm what you did. "
                "Keep responses concise and friendly.\n\n"
                "At the end of your response, on a new line, output a JSON array of "
                "action descriptions you performed (empty array [] if no actions taken). "
                "Format: ACTIONS: [\"action 1\", \"action 2\"]"
            ),
            expected_output="A helpful response followed by ACTIONS: [...] on its own line.",
            agent=manager,
        )

        crew = Crew(
            agents=[manager],
            tasks=[chat_task],
            process=Process.sequential,
            verbose=True,
        )

        result = str(crew.kickoff()).strip()

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


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
