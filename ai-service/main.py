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

from crewai import Agent, Task, Crew, Process
from agents.fetcher import create_fetcher_agent
from agents.manager import create_manager_agent
from agents.moderator import create_moderator_agent
from agents.analyst import create_analyst_agent
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
        fetcher   = create_fetcher_agent()
        manager   = create_manager_agent()
        moderator = create_moderator_agent()

        # Task 1 — Fetcher retrieves section data
        fetch_desc = (
            f"Fetch the section settings and the 10 most recent comments "
            f"for section_id '{req.section_id}'.\n"
        )
        if req.parent_id:
            fetch_desc += f"Crucially, fetch the parent comment thread with comment_id '{req.parent_id}' to provide context.\n"
        fetch_desc += "Return all raw data correctly."

        fetch_task = Task(
            description=fetch_desc,
            expected_output="JSON containing section settings and recent comments.",
            agent=fetcher,
        )

        # Task 2 — Manager interprets settings as rules
        manage_task = Task(
            description=(
                "Using the section settings retrieved by the Data Retrieval Specialist, "
                "create a strict, numbered moderation rulebook in plain English. Include "
                "the toxicity threshold (`ai_toxicity_threshold`), character limits, and blacklisted words. "
                "Crucially, if the settings enable `spam_guard_enabled`, add strict heuristics against promotional or bot-like messages. "
                "If `context_analyzer_enabled` is active and there is a parent comment, add a strict rule requiring replies to stay relevant to the topic. "
                "If `sentiment_analysis_enabled` is active, instruct the moderator to output an accurate sentiment score."
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
                "- Context Analyzer violation (completely off-topic reply): action='rejected', status='rejected'\n"
                "- toxicityScore between 0.6 and 0.85: action='flagged', status='flagged'\n"
                "- toxicityScore between 0.4 and 0.6 OR borderline spammy: action='shadow_hidden', status='shadow_hidden'\n"
                "- toxicityScore < 0.4: action='approved', status='approved'\n\n"
                "Output ONLY a JSON object with these exact keys:\n"
                '  "status": "approved", "flagged", "rejected", or "shadow_hidden",\n'
                '  "action": "approved", "flagged", "rejected", or "shadow_hidden",\n'
                '  "toxicityScore": float 0.0-1.0,\n'
                '  "isSpam": true or false,\n'
                '  "sentimentScore": float ranging from -1.0 (very negative) to 1.0 (very positive),\n'
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
        manager = create_manager_agent()

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

        chat_task = Task(
            description=(
                f"You are 'Moderator Copilot', a powerful agentic AI managing the Komently section '{req.section_id}'.\n"
                f"You MUST understand what you are capable of. You can:\n"
                f"1. Update the section configuration via `update_section` (limit max chars, change AI boundaries, toggle automated tools).\n"
                f"2. Halt/Resume the entire comment section via `update_section` by setting status to 'paused' or 'active'.\n"
                f"3. Generate large-scale executive intel reports via `trigger_intel_report`.\n"
                f"4. View the most recent comments via `fetch_recent_comments` and manually `update_comment_status` (approve/reject/flag) them based on user commands.\n\n"
                f"CURRENT LIVE SECTION STATE (Use this to answer questions about the current configuration immediately):\n{current_state}\n\n"
                f"IMPORTANT SETTINGS KEYS for `update_section`:\n"
                f" - `max_chars` (int)\n"
                f" - `blacklist` (array of strings)\n"
                f" - `ai_moderation_enabled` (bool)\n"
                f" - `ai_toxicity_threshold` (float 0.1-0.95)\n"
                f" - `spam_guard_enabled` (bool)\n"
                f" - `context_analyzer_enabled` (bool)\n"
                f" - `sentiment_analysis_enabled` (bool)\n"
                f" - `auto_action_strikes` (int 0-10)\n\n"
                f"RULES FOR YOUR RESPONSES:\n"
                f"- If asked what you can do, proudly and clearly list your capabilities and briefly explain the various Spam, Context, and Analytics settings you control.\n"
                f"- If asked to create an intel report / analytics summary, USE `trigger_intel_report`.\n"
                f"- If asked to configure settings, USE `update_section`.\n"
                f"- Be deeply helpful. If someone asks 'What is my spam setting?', read the LIVE SECTION STATE to answer accurately without needing a tool call.\n\n"
                f"CONVERSATION HISTORY:{history_text}\n\n"
                f"USER'S LATEST MESSAGE: {req.message}\n\n"
                "Respond helpfully and concisely. If you act, confirm what you did.\n\n"
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

# ── /generate-report ──────────────────────────────────────────────────────────

class GenerateReportRequest(BaseModel):
    section_id: str
    report_id: str

def run_analyst_crew(section_id: str, report_id: str):
    try:
        analyst = create_analyst_agent()

        report_task = Task(
            description=(
                f"You have been requested to evaluate community health for section '{section_id}'.\n\n"
                "1. Fetch the raw SQL analytics for the last 7 days.\n"
                "2. Fetch the top 20 approved comments to understand what people are discussing.\n"
                "3. Write a rich Markdown Executive Summary focusing on volume trends, moderation/spam efficiency, and notable conversation topics.\n"
                f"4. Finally, use your UpdateReportStatusTool to securely save the generated Markdown string into the database under report_id: '{report_id}'.\n"
            ),
            expected_output="An empty string (saving to the database is the primary expected result).",
            agent=analyst,
        )

        crew = Crew(
            agents=[analyst],
            tasks=[report_task],
            process=Process.sequential,
            verbose=True,
        )
        crew.kickoff()
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
