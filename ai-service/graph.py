import json
import os
from typing import TypedDict, Annotated, List, Union
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from crew import ModerationCrew, ChatCrew, AnalystCrew

# 1. Define Stronger State

class GraphState(TypedDict):
    """Represents the state of our orchestrator."""
    input: str
    section_id: str
    history: List[dict]

    # orchestration
    next_action: str
    confidence: float

    # outputs
    crew_output: Union[dict, str, None]
    result: str

    # metadata
    user_id: str | None
    origin: str  # e.g., "/moderate", "/chat", "/report"
    flags: dict

# 2. Utility for Crew Execution

def run_crew(crew_class, inputs):
    """Helper to instantiate and kickoff a CrewAI crew."""
    crew_instance = crew_class()
    return crew_instance.crew().kickoff(inputs=inputs)

# 3. Nodes

def router_node(state: GraphState):
    """
    Intelligent router. 
    Uses the message origin as context, but allows the LLM to override
    based on the user's actual intent.
    """
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    
    prompt = f"""
    You are the system orchestrator for Komently.
    
    User Message: "{state['input']}"
    Message Origin: {state.get('origin', 'unknown')}

    CONTEXT:
    The user is interacting via the '{state.get('origin')}' endpoint. 
    - Usually, requests from '/moderate' should go to 'moderation'.
    - Usually, requests from '/chat' should go to 'chat'.
    - Usually, requests from '/report' should go to 'analyst'.
    - The /moderate endpoint must never be routed other than moderation.
    
    HOWEVER, if the user's CLEAR INTENT is different (e.g., they are asking for a report 
    while in the chat), override the default and route appropriately. 

    Options:
    - moderation: reviewing comments, checking toxicity/spam.
    - chat: help, conversation, configuration questions.
    - analyst: requests for reports, summaries, or analytics.

    Return ONLY a JSON object:
    {{ "route": "moderation" | "chat" | "analyst", "confidence": 0-1, "reasoning": "brief explanation" }}
    """

    res = llm.invoke(prompt)
    
    content = res.content.strip()
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0].strip()
    elif "```" in content:
        content = content.split("```")[1].split("```")[0].strip()
        
    try:
        data = json.loads(content)
    except:
        # Fallback to origin if LLM fails
        origin = state.get('origin', '/chat')
        route = "moderation" if "/moderate" in origin else "chat"
        data = {"route": route, "confidence": 0.5}

    return {
        "next_action": data.get("route", "chat"),
        "confidence": data.get("confidence", 0.0)
    }

def moderation_node(state: GraphState):
    """Executes the ModerationCrew."""
    result = run_crew(
        ModerationCrew,
        {
            "comment_body": state["input"],
            "section_id": state["section_id"],
            "parent_context": ""
        }
    )
    
    # Extract string and try parsing JSON
    raw_str = result.raw
    try:
        clean_json = raw_str.strip()
        if "```" in clean_json:
            clean_json = clean_json.split("```")[1]
            if clean_json.startswith("json"): clean_json = clean_json[4:]
            clean_json = clean_json.strip()
        verdict = json.loads(clean_json)
    except:
        verdict = {"status": "approved", "reason": "Parsing failed", "raw": raw_str}

    return {
        "crew_output": verdict,
        "result": raw_str,
        "flags": {"moderated": True}
    }

def chat_node(state: GraphState):
    """Executes the ChatCrew."""
    history_text = ""
    for msg in state.get("history", [])[-10:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        history_text += f"\n{role.upper()}: {content}"

    result = run_crew(
        ChatCrew,
        {
            "user_message": state["input"],
            "section_id": state["section_id"],
            "history_text": history_text,
            "current_state": "Context provided via tools."
        }
    )
    
    raw_str = result.raw
    return {
        "crew_output": {"raw": raw_str},
        "result": raw_str
    }

def analyst_node(state: GraphState):
    """Executes the AnalystCrew."""
    result = run_crew(
        AnalystCrew,
        {
            "section_id": state["section_id"],
            "report_id": state.get("flags", {}).get("report_id", "manual_trigger")
        }
    )
    
    raw_str = result.raw
    return {
        "crew_output": {"raw": raw_str},
        "result": raw_str
    }

def finalize_node(state: GraphState):
    """Cleans up and formats the final result."""
    return {
        "result": state["result"],
        "crew_output": state["crew_output"]
    }

# 4. Routing Logic

def route_decision(state: GraphState):
    """Returns the name of the next node to visit."""
    return state["next_action"]

# 5. Build Graph

def build_graph():
    workflow = StateGraph(GraphState)

    # Add Nodes
    workflow.add_node("router", router_node)
    workflow.add_node("moderator", moderation_node)
    workflow.add_node("chat", chat_node)
    workflow.add_node("analyst", analyst_node)
    workflow.add_node("finalize", finalize_node)

    # Set Entry Point
    workflow.set_entry_point("router")

    # Add Conditional Edges
    workflow.add_conditional_edges(
        "router",
        route_decision,
        {
            "moderation": "moderator",
            "chat": "chat",
            "analyst": "analyst",
        }
    )

    # Connect to Finalize
    workflow.add_edge("moderator", "finalize")
    workflow.add_edge("chat", "finalize")
    workflow.add_edge("analyst", "finalize")

    # Connect to END
    workflow.add_edge("finalize", END)

    return workflow.compile()

# Singleton instance
komently_app = build_graph()
