# LangGraph Implementation Report — Komently AI Service

## Overview

LangGraph acts as the **orchestration layer** of the Komently AI Service. It sits between the FastAPI HTTP layer and the CrewAI agent crews, deciding *which* crew to run for each request, managing shared state across the lifecycle of a request, and standardizing all outputs before they reach the caller.

---

## Architecture Diagram

```
HTTP Request (FastAPI)
        │
        ▼
┌───────────────────────────────────────────┐
│             LangGraph Graph               │
│                                           │
│  ┌─────────┐                              │
│  │ router  │ ← GPT-4o-mini classifies     │
│  └────┬────┘   intent                     │
│       │                                   │
│  ┌────┴─────────────────┐                 │
│  │  Conditional Branch  │                 │
│  └─┬──────────┬─────────┘                 │
│    │          │          │                │
│    ▼          ▼          ▼                │
│ moderator   chat      analyst             │
│    │          │          │                │
│    └──────────┴──────────┘                │
│               │                           │
│               ▼                           │
│           finalize                        │
│               │                           │
│               ▼                           │
│             END                           │
└───────────────────────────────────────────┘
        │
        ▼
  HTTP Response
```

Each of the three leaf nodes (`moderator`, `chat`, `analyst`) delegates execution to a **CrewAI crew** via the `execute_crew_task()` bridge function.

---

## File Reference

| File | Role |
|------|------|
| [`graph.py`](graph.py) | All LangGraph logic: state, nodes, edges, graph compilation |
| [`crew.py`](crew.py) | CrewAI crew definitions called from within graph nodes |
| [`main.py`](main.py) | FastAPI endpoints that invoke `komently_app` |

---

## State Schema — `GraphState`

Defined in [`graph.py:14`](graph.py#L14), `GraphState` is a `TypedDict` that acts as the single shared memory object passed between every node in the graph.

```python
class GraphState(TypedDict):
    input: str           # raw user message or comment body
    section_id: str      # Komently section being operated on
    history: List[dict]  # conversation history (used by /chat)

    next_action: str     # routing decision: "moderation" | "chat" | "analyst"
    confidence: float    # routing confidence (reserved for future use)

    crew_output: Union[dict, str, None]  # raw crew result
    final_response: str                  # cleaned output sent to the caller

    metadata: dict       # origin endpoint, comment_id, report_id, tracing flags
```

**Why a shared TypedDict?** LangGraph nodes are pure functions — they receive state and return a partial state update. The TypedDict enforces a contract so that LangGraph nodes and CrewAI bridge code both read and write the same keys with known types.

---

## Nodes

### 1. `router` — [`graph.py:66`](graph.py#L66)

The entry point of every request. Uses `ChatOpenAI(model="gpt-4o-mini", temperature=0)` to classify the incoming `state["input"]` into one of three routes.

**Prompt strategy:** The LLM is asked to return a raw JSON object with `{ "route": "...", "reasoning": "..." }`. Markdown code fences are stripped before parsing. Falls back to `"chat"` on any parse error.

**Returns:** `{ "next_action": "moderation" | "chat" | "analyst" }`

```python
def intelligent_router(state: GraphState):
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    # classify state["input"] → route
    return {"next_action": route}
```

---

### 2. `moderator` — [`graph.py:98`](graph.py#L98)

Delegates to `ModerationCrew` via `execute_crew_task()`.

**Crew pipeline (sequential):**
1. **Fetcher agent** — reads section settings, recent comments, parent thread from Supabase
2. **Manager agent** — builds a plain-English rulebook from those settings
3. **Moderator agent** — evaluates the comment against the rulebook and outputs a JSON verdict

---

### 3. `chat` — [`graph.py:101`](graph.py#L101)

Delegates to `ChatCrew` via `execute_crew_task()`.

**Crew pipeline:** Single **Manager agent** with access to all six Supabase tools. Handles FAQ, account settings, and general community management queries. Receives the last 5 turns of conversation history via `history_text`.

---

### 4. `analyst` — [`graph.py:104`](graph.py#L104)

Delegates to `AnalystCrew` via `execute_crew_task()`.

**Crew pipeline:** Single **Analyst agent** that fetches 7-day analytics, top comments, and writes a markdown report back to the database.

---

### 5. `finalize` — [`graph.py:107`](graph.py#L107)

A post-processing node that runs after every crew path converges. Its responsibility is output standardization:

- If the `final_response` string contains a JSON object, it is extracted and parsed into `crew_output` as a `dict`.
- Non-JSON responses (e.g. plain text from the chat crew) are passed through unchanged.

This ensures the caller always sees a predictable output shape regardless of which crew ran.

---

## Edges & Conditional Routing

```python
workflow.set_entry_point("router")

workflow.add_conditional_edges(
    "router",
    lambda x: x["next_action"],   # reads routing decision from state
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
```

`add_conditional_edges` reads `next_action` from state after `router` completes and selects the target node. All three paths converge at `finalize` before the graph terminates.

---

## Persistence — `MemorySaver`

```python
memory = MemorySaver()
workflow.compile(checkpointer=memory)
```

The graph is compiled with an in-memory checkpointer. Each invocation is tied to a `thread_id` (set per request in `main.py`) which lets LangGraph restore prior state for the same conversation thread. This enables multi-turn continuity for the `/chat` endpoint.

| Endpoint | thread_id pattern |
|----------|------------------|
| `/moderate` | `mod_{section_id}_{comment_id}` |
| `/chat` | `chat_{section_id}` |
| `/generate-report` | `report_{section_id}_{report_id}` |

> **Note:** `MemorySaver` is in-process only — state is lost on restart. Swapping to `SqliteSaver` or `PostgresSaver` would make threads persistent across restarts.

---

## CrewAI Integration — `execute_crew_task()`

Defined in [`graph.py:35`](graph.py#L35), this function is the **sole bridge** between LangGraph and CrewAI. Every crew node calls it.

```python
def execute_crew_task(state: GraphState, crew_class) -> dict:
    crew_inputs = {
        "input": state["input"],
        "section_id": state["section_id"],
        "history_text": "\n".join([
            f"{m['role']}: {m['content']}"
            for m in state.get('history', [])[-5:]   # last 5 turns only
        ]),
        **state.get('metadata', {})   # origin, comment_id, report_id, etc.
    }

    crew_instance = crew_class()
    result = crew_instance.crew().kickoff(inputs=crew_inputs)

    return {
        "crew_output": result.raw,
        "final_response": result.raw,
        "metadata": {**state.get('metadata', {}), "last_agent": "CrewAI"}
    }
```

**What it does:**
1. **Translates state → CrewAI inputs.** CrewAI crews receive a flat dict of strings. The function maps typed LangGraph state fields into that dict, including flattening conversation history into a newline-separated string.
2. **Instantiates and kicks off the crew.** Each call creates a fresh crew instance.
3. **Translates CrewAI output → state update.** The raw string result is written back into both `crew_output` and `final_response`, and `metadata` is updated with `"last_agent": "CrewAI"` for tracing.

**The integration contract:**

```
LangGraph State  ──[execute_crew_task]──▶  CrewAI inputs dict
                                               │
                                         crew().kickoff()
                                               │
CrewAI result.raw  ◀──────────────────────────┘
      │
      └──▶  state["crew_output"] + state["final_response"]
```

---

## FastAPI Integration — `main.py`

The compiled graph is exported as `komently_app` from `graph.py` and imported into `main.py`. All three endpoints follow the same invocation pattern:

```python
from graph import komently_app

output = komently_app.invoke(inputs, config=config)
```

### `/moderate` — [`main.py:67`](main.py#L67)

```python
inputs = {
    "input": req.body,
    "section_id": req.section_id,
    "metadata": {"origin": "/moderate", "comment_id": req.comment_id}
}
config = {"configurable": {"thread_id": f"mod_{req.section_id}_{req.comment_id}"}}
output = komently_app.invoke(inputs, config=config)
verdict = output.get("crew_output", {})
```

Extracts fields from `crew_output` (a dict parsed from the Moderator agent's JSON output) to populate the `ModerationVerdict` response model. Has a fail-safe: on any exception, returns `status: approved` to avoid blocking legitimate users.

### `/chat` — [`main.py:125`](main.py#L125)

```python
inputs = {
    "input": req.message,
    "section_id": req.section_id,
    "history": req.history,
    "metadata": {"origin": "/chat"}
}
config = {"configurable": {"thread_id": f"chat_{req.section_id}"}}
output = komently_app.invoke(inputs, config=config)
result = output.get("final_response", "")
```

Uses a persistent `thread_id` per section so conversation history accumulates across calls. Parses an optional `ACTIONS: [...]` suffix from the response for structured action tracking.

### `/generate-report` — [`main.py:185`](main.py#L185)

```python
def run_analyst_crew(section_id: str, report_id: str):
    inputs = {"input": "Generate a weekly report.", "section_id": section_id, ...}
    komently_app.invoke(inputs, config=config)

tasks.add_task(run_analyst_crew, req.section_id, req.report_id)
return {"status": "processing", "report_id": req.report_id}
```

The graph is invoked inside a FastAPI `BackgroundTasks` function. The endpoint returns `202 Accepted` immediately; the Analyst crew runs asynchronously and writes its report directly to the database via `UpdateReportStatusTool`.

---

## Observability — LangSmith

```python
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_PROJECT"] = "Komently-Advanced-Orchestrator"
```

Set at module load in `graph.py`. Every graph invocation — including all LLM calls inside the router and every tool call inside each CrewAI agent — is automatically traced to the `Komently-Advanced-Orchestrator` LangSmith project. No additional instrumentation is required.

---

## Data Flow Summary

```
POST /moderate  { comment_id, section_id, body }
        │
        ▼
  komently_app.invoke({
      input: body,
      section_id: section_id,
      metadata: { origin: "/moderate", comment_id }
  }, thread_id="mod_<section>_<comment>")
        │
        ▼
  [router node]  →  GPT-4o-mini classifies → next_action = "moderation"
        │
        ▼
  [moderator node]  →  execute_crew_task(state, ModerationCrew)
        │                  ├─ Fetcher: reads Supabase settings & context
        │                  ├─ Manager: builds rulebook
        │                  └─ Moderator: outputs JSON verdict
        │
        ▼
  [finalize node]  →  extracts JSON from final_response → crew_output = dict
        │
        ▼
  output["crew_output"] = { status, action, toxicityScore, isSpam, reason }
        │
        ▼
  ModerationVerdict HTTP response
```

---

## Limitations & Improvement Opportunities

| Area | Current State | Suggested Improvement |
|------|--------------|----------------------|
| **Persistence** | `MemorySaver` (in-process, lost on restart) | `PostgresSaver` for durable cross-restart threads |
| **Router fallback** | Falls back to `"chat"` on any parse error | Add confidence score; route low-confidence requests to a human review queue |
| **Parallel execution** | All nodes run sequentially | Use LangGraph's `Send()` API to fan out to multiple crews in parallel |
| **Error handling** | Try/except in endpoints only | Add a dedicated `error` node in the graph for structured failure handling |
| **History truncation** | Hard-coded last 5 turns | Make window size configurable per section or per crew type |
| **Analyst async** | Runs in FastAPI `BackgroundTasks` | Move to a dedicated task queue (Celery, ARQ) for reliability and retries |
