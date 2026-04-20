import json
import os
from typing import TypedDict, Annotated, List, Union, Optional
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langchain_openai import ChatOpenAI
from crew import ModerationCrew, ChatCrew, AnalystCrew

# --- LangSmith Integration ---
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_PROJECT"] = "Komently-Advanced-Orchestrator"

# 1. Advanced State Definition
class GraphState(TypedDict):
    """
    Unified state for LangGraph and CrewAI.
    This allows both frameworks to 'speak the same language'.
    """
    input: str
    section_id: str
    history: List[dict]
    
    # Routing & Flow
    next_action: str
    confidence: float
    
    # Structured Outputs
    crew_output: Union[dict, str, None]
    final_response: str
    
    # Metadata for tracing/debugging
    metadata: dict

# 2. Advanced Crew Wrapper
def execute_crew_task(state: GraphState, crew_class) -> dict:
    """
    A 'Better' way to run Crews: 
    It explicitly maps the LangGraph state into CrewAI inputs 
    and handles the transition back to LangGraph cleanly.
    """
    print(f"[Advanced-Graph] Handoff to CrewAI: {crew_class.__name__}")
    
    # Prepare inputs specifically from current state
    crew_inputs = {
        "input": state["input"],
        "section_id": state["section_id"],
        "history_text": "\n".join([f"{m['role']}: {m['content']}" for m in state.get('history', [])[-5:]]),
        # Add flags from state metadata
        **state.get('metadata', {})
    }
    
    crew_instance = crew_class()
    result = crew_instance.crew().kickoff(inputs=crew_inputs)
    
    # Log the transition for LangSmith
    print(f"[Advanced-Graph] Crew completed. Result size: {len(str(result.raw))} chars")
    
    return {
        "crew_output": result.raw,
        "final_response": result.raw,
        "metadata": {**state.get('metadata', {}), "last_agent": "CrewAI"}
    }

# 3. Enhanced Nodes

def intelligent_router(state: GraphState):
    """
    Uses GPT-4o-mini as a 'Control Plane' to decide which 'Worker Plane' (CrewAI) to call.
    """
    print(f"[Advanced-Graph] Step: Routing | Input: {state['input'][:50]}...")
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    
    prompt = f"""
    System: Komently Orchestrator.
    Input: "{state['input']}"
    Origin: {state.get('metadata', {}).get('origin', 'direct')}

    Task: Classify this request into one of the specialized crews:
    1. 'moderation': Content safety, spam, toxicity, and rule enforcement.
    2. 'chat': General help, account settings, or FAQ interaction.
    3. 'analyst': Generating reports, summaries, or data exports.

    Response: Return ONLY a JSON object with keys: "route", "reasoning".
    """
    
    res = llm.invoke(prompt)
    try:
        # Clean potential markdown from LLM
        raw_json = res.content.strip().replace("```json", "").replace("```", "")
        data = json.loads(raw_json)
        route = data.get("route", "chat")
    except:
        route = "chat"
    
    print(f"[Advanced-Graph] Decided Route: {route}")
    return {"next_action": route}

def moderation_node(state: GraphState):
    return execute_crew_task(state, ModerationCrew)

def chat_node(state: GraphState):
    return execute_crew_task(state, ChatCrew)

def analyst_node(state: GraphState):
    return execute_crew_task(state, AnalystCrew)

def post_process_node(state: GraphState):
    """
    A unified cleanup node. 
    A 'Better' integration pattern ensures all outputs go through a 
    standardization step before reaching the user.
    """
    print("[Advanced-Graph] Step: Finalizing Output")
    raw = state.get("final_response", "")
    
    # If the output is JSON (typical for moderation), parse it
    if "{" in raw and "}" in raw:
        try:
            # Simple attempt to extract JSON if agents wrapped it in text
            json_str = raw[raw.find("{"):raw.rfind("}")+1]
            state["crew_output"] = json.loads(json_str)
        except:
            pass

    return state

# 4. Build the Unified Graph

def create_komently_brain():
    workflow = StateGraph(GraphState)

    # Define Nodes
    workflow.add_node("router", intelligent_router)
    workflow.add_node("moderator", moderation_node)
    workflow.add_node("chat", chat_node)
    workflow.add_node("analyst", analyst_node)
    workflow.add_node("finalize", post_process_node)

    # Define Flow
    workflow.set_entry_point("router")
    
    workflow.add_conditional_edges(
        "router",
        lambda x: x["next_action"],
        {
            "moderation": "moderator",
            "chat": "chat",
            "analyst": "analyst"
        }
    )

    workflow.add_edge("moderator", "finalize")
    workflow.add_edge("chat", "finalize")
    workflow.add_edge("analyst", "finalize")
    workflow.add_edge("finalize", END)

    # Add persistence
    memory = MemorySaver()
    return workflow.compile(checkpointer=memory)

# Exported Instance
komently_app = create_komently_brain()

