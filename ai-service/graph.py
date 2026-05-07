# ai-service/graph.py
# Stateful moderation lifecycle.
# LangGraph owns the comment's journey: run → route on confidence → retry / deep-review / escalate / approve.
# ChatCrew and AnalystCrew are called directly from main.py — they don't need a graph.

import json
import os
from typing import TypedDict, List, Union, Optional

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import interrupt

from crew import ModerationCrew

os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_PROJECT"] = "Komently-Advanced-Orchestrator"


# ── State ─────────────────────────────────────────────────────────────────────

class GraphState(TypedDict):
    # Request
    input: str
    section_id: str
    history: List[dict]

    # Moderation lifecycle — written by nodes, read by router
    toxicity_score: Optional[float]
    confidence: Optional[float]
    retry_count: Optional[int]
    escalation_reason: Optional[str]

    # Outputs
    crew_output: Union[dict, str, None]
    final_response: Optional[str]

    # Tracing
    metadata: dict


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_json(raw) -> dict:
    """Pull a JSON object out of a string that may contain surrounding text."""
    if isinstance(raw, dict):
        return raw
    if not isinstance(raw, str) or not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    try:
        start, end = raw.find("{"), raw.rfind("}") + 1
        if start != -1 and end > start:
            return json.loads(raw[start:end])
    except json.JSONDecodeError:
        pass
    return {}


def _run_crew(state: GraphState, strict: bool = False) -> dict:
    """Kick off the hierarchical ModerationCrew and normalise the result into state."""
    retry = int(state.get("retry_count") or 0)
    print(f"[Graph] ModerationCrew | strict={strict} | retry={retry}")

    inputs = {
        "input": state["input"],
        "section_id": state["section_id"],
        "parent_id": state.get("metadata", {}).get("parent_id", ""),
        "strict_context": (
            "\nNOTE: Deep-review pass — apply conservative standards, "
            "lower your approval threshold by 0.1, err on the side of caution.\n"
        ) if strict else "",
    }

    result = ModerationCrew().crew().kickoff(inputs=inputs)
    output = _extract_json(result.raw)

    return {
        "crew_output": output or result.raw,
        "final_response": result.raw,
        "toxicity_score": float(output.get("toxicityScore", 0.0)),
        "confidence": float(output.get("confidence", 1.0)),
        "escalation_reason": output.get("reason", ""),
        "metadata": {**state.get("metadata", {}), "last_agent": "ModerationCrew"},
    }


# ── Nodes ─────────────────────────────────────────────────────────────────────

def moderation_node(state: GraphState) -> dict:
    return _run_crew(state, strict=False)


def retry_node(state: GraphState) -> dict:
    count = int(state.get("retry_count") or 0) + 1
    print(f"[Graph] Retry #{count} — low confidence on previous pass")
    return {"retry_count": count}


def deep_review_node(state: GraphState) -> dict:
    score = state.get("toxicity_score", 0)
    print(f"[Graph] Deep review — borderline score {score:.2f}, re-running strict")
    return _run_crew(state, strict=True)


def escalate_node(state: GraphState) -> dict:
    score = state.get("toxicity_score", 0.8)
    print(f"[Graph] Escalating to human — toxicity={score:.2f}")

    # Pause graph; dashboard moderator provides the decision to resume
    human_decision = interrupt({
        "type": "human_review_required",
        "comment": state["input"],
        "toxicity_score": score,
        "section_id": state["section_id"],
        "reason": state.get("escalation_reason", "High toxicity score"),
    })

    # Resumes here once dashboard sends Command(resume={status: ...})
    status = (
        human_decision.get("status", "flagged")
        if isinstance(human_decision, dict)
        else "flagged"
    )
    verdict = {
        "status": status,
        "action": status,
        "toxicityScore": score,
        "isSpam": False,
        "sentimentScore": 0.0,
        "confidence": 1.0,
        "reason": f"Human moderation decision: {status}",
    }
    return {"crew_output": verdict, "final_response": json.dumps(verdict)}


def auto_approve_node(state: GraphState) -> dict:
    score = state.get("toxicity_score", 0.0)
    print(f"[Graph] Auto-approving — toxicity={score:.2f}")
    output = _extract_json(state.get("crew_output") or {})
    output = {**output, "status": "approved", "action": "approved"}
    return {"crew_output": output, "final_response": json.dumps(output)}


def finalize_node(state: GraphState) -> dict:
    print("[Graph] Finalising output")
    output = _extract_json(state.get("final_response") or "")
    if output:
        return {"crew_output": output, "final_response": json.dumps(output)}

    # final_response was unparseable — fall back to whatever crew_output already holds
    fallback = _extract_json(state.get("crew_output") or "")
    if fallback:
        print("[Graph] WARNING: final_response was not JSON; using crew_output as fallback")
        return {"crew_output": fallback, "final_response": json.dumps(fallback)}

    print("[Graph] WARNING: no parseable output — defaulting to safe 'flagged' verdict")
    safe = {
        "status": "flagged", "action": "flagged",
        "toxicityScore": 0.0, "isSpam": False,
        "sentimentScore": 0.0, "confidence": 0.0,
        "reason": "Moderation output was unreadable; flagged for safety.",
    }
    return {"crew_output": safe, "final_response": json.dumps(safe)}


# ── Conditional routing ───────────────────────────────────────────────────────

def route_on_output(state: GraphState) -> str:
    toxicity = float(state.get("toxicity_score") or 0.0)
    confidence = float(state.get("confidence") or 1.0)
    retries = int(state.get("retry_count") or 0)

    # Parse isSpam from the crew output so spam isn't silently approved
    crew_output = state.get("crew_output") or {}
    if isinstance(crew_output, str):
        crew_output = _extract_json(crew_output)
    is_spam = crew_output.get("isSpam", False) if isinstance(crew_output, dict) else False

    if confidence < 0.5:
        return "retry" if retries < 2 else "finalize"
    if is_spam:
        # Crew already decided to reject for spam — trust it, skip human escalation
        return "finalize"
    if toxicity > 0.7:
        return "escalate"
    if 0.3 <= toxicity <= 0.7:
        return "deep_review"
    return "auto_approve"


# ── Graph assembly ────────────────────────────────────────────────────────────

def create_moderation_graph():
    wf = StateGraph(GraphState)

    wf.add_node("moderation",   moderation_node)
    wf.add_node("retry",        retry_node)
    wf.add_node("deep_review",  deep_review_node)
    wf.add_node("escalate",     escalate_node)
    wf.add_node("auto_approve", auto_approve_node)
    wf.add_node("finalize",     finalize_node)

    wf.set_entry_point("moderation")

    wf.add_conditional_edges(
        "moderation",
        route_on_output,
        {
            "retry":        "retry",
            "escalate":     "escalate",
            "deep_review":  "deep_review",
            "auto_approve": "auto_approve",
            "finalize":     "finalize",   # spam or exhausted retries — skip auto_approve
        },
    )

    wf.add_edge("retry",        "moderation")   # ← cycle, max 2 iterations
    wf.add_edge("deep_review",  "finalize")     # no further routing after deep review
    wf.add_edge("escalate",     "finalize")
    wf.add_edge("auto_approve", "finalize")
    wf.add_edge("finalize",     END)

    return wf.compile(checkpointer=MemorySaver())


komently_app = create_moderation_graph()
