# Komently AI Service — Project Summary
**Author:** Emircan Gezer
**Date:** May 2026

---

## 1. What Is Komently?

Komently is an AI-powered comment moderation SaaS. Website owners embed a comment section on their site; Komently's AI service evaluates every incoming comment in real time and decides whether to approve, flag, shadow-hide, or reject it. Section owners manage their community through a dashboard that lets them configure rules, chat with an AI copilot, and receive weekly analytics reports.

The AI service is a **FastAPI application** backed by three agentic frameworks — each with a distinct, non-overlapping responsibility.

```mermaid
graph TD
    A[Website / App\nnew comment] --> API[FastAPI AI Service]
    B[Dashboard Owner\nchat · config · reports] --> API
    API -->|verdict| A
    API -->|read + write| DB[(Supabase)]

    subgraph Frameworks
        LG[LangGraph\nModeration Lifecycle]
        CA[CrewAI\nAgent Crews]
        MCP[MCP\nTool Layer]
    end

    API --> LG
    LG --> CA
    CA --> MCP
    MCP --> DB

    style LG fill:#e3f2fd,stroke:#1565c0
    style CA fill:#e8f5e9,stroke:#2e7d32
    style MCP fill:#f3e5f5,stroke:#6a1b9a
```

---

## 2. API Endpoints

Four endpoints. Each has a distinct owner in the framework stack.

| Endpoint | Trigger | Returns |
|---|---|---|
| `POST /moderate` | Every new comment | Moderation verdict JSON |
| `POST /chat` | Dashboard owner message | Reply + list of actions taken |
| `POST /generate-report` | Internal trigger from `trigger_intel_report` | `202 Accepted` — report saved async |
| `PATCH /moderate/{thread_id}/resume` | Moderator human decision | Final verdict after human review |

---

## 3. Endpoint Deep-Dives

### 3.1 `POST /moderate`

Runs the full stateful moderation lifecycle via LangGraph. Every comment travels through confidence-based routing, optional retries, optional deep review, and optional human escalation before a final verdict is written.

**Request:**
```json
{
  "comment_id": "uuid",
  "section_id": "uuid",
  "body": "comment text",
  "parent_id": "uuid | null"
}
```

**Response (`ModerationVerdict`):**
```json
{
  "status": "approved | flagged | rejected | shadow_hidden",
  "action": "approved | flagged | rejected | shadow_hidden",
  "toxicity_score": 0.0,
  "is_spam": false,
  "reason": "brief explanation",
  "metadata": { "sentiment_score": 0.0, "confidence": 1.0 }
}
```

**Flow:**

```mermaid
graph TD
    REQ[POST /moderate\ncomment_id · section_id · body · parent_id]
    REQ --> CFG[Build LangGraph config\nthread_id = mod_commentId_uuid8]
    CFG --> LG[komently_app.invoke\nLangGraph starts]

    LG --> MN[moderation_node\nModerationCrew.kickoff]

    MN --> RO{route_on_output}

    RO -->|isSpam = true| FN[finalize_node\ncrew verdict stands]
    RO -->|confidence < 0.5\nretry < 2| RT[retry_node\n+1 retry_count]
    RO -->|confidence < 0.5\nretry ≥ 2| FN
    RO -->|toxicity > 0.7| ES[escalate_node\ninterrupt — pause graph]
    RO -->|0.3 ≤ tox ≤ 0.7| DR[deep_review_node\nstrict re-run]
    RO -->|toxicity < 0.3\nno spam| AA[auto_approve_node\nforce approved]

    RT --> MN
    DR --> FN
    AA --> FN

    ES -->|GraphInterrupt raised| GI[API catches GraphInterrupt\nextracts real toxicity from payload]
    GI --> FR[Return flagged verdict\nmetadata.pending_thread_id = thread_id]

    FN --> OUT[Return ModerationVerdict]

    style RO fill:#fff9c4,stroke:#f9a825
    style ES fill:#ffcdd2,stroke:#c62828
    style DR fill:#ffe0b2,stroke:#e65100
    style AA fill:#c8e6c9,stroke:#2e7d32
    style GI fill:#ffcdd2,stroke:#c62828
```

**Error handling:**
- `GraphInterrupt` → returns `flagged` + `pending_thread_id` for human review
- Any other exception → fail-safe `approved` response (never silently blocks users)
- Empty/unparseable crew output → `finalize_node` falls back to `crew_output`, then to a safe `flagged` default

---

### 3.2 `PATCH /moderate/{thread_id}/resume`

Resumes a graph that was paused at `escalate_node` after a human moderator reviews the comment in the dashboard.

**Request:**
```json
{ "status": "approved | rejected | flagged" }
```

**Response:** Same `ModerationVerdict` shape with `metadata.resumed_by_human = true`.

**Flow:**

```mermaid
graph TD
    REQ[PATCH /moderate/thread_id/resume\nbody: status=approved or rejected]
    REQ --> VAL{Validate status}
    VAL -->|invalid| E400[HTTP 400]
    VAL -->|valid| CMD[langgraph Command\nresume = status]
    CMD --> LG[komently_app.invoke\nresumed from checkpoint]
    LG --> ES[escalate_node continues\nbuilds human verdict JSON]
    ES --> FN[finalize_node]
    FN --> OUT[Return ModerationVerdict\nresumed_by_human=true]

    style CMD fill:#e8f5e9,stroke:#2e7d32
    style FN fill:#e3f2fd,stroke:#1565c0
```

---

### 3.3 `POST /chat`

Dashboard chat. Calls `ChatCrew` directly — no LangGraph overhead needed for a single conversational pass. Before kicking off the crew, the API calls `fetch_section_settings` from `mcp_server.py` directly so the agent can answer configuration questions instantly without spending a tool call of its own.

**Request:**
```json
{
  "section_id": "uuid",
  "message": "user message",
  "history": [{ "role": "user", "content": "..." }]
}
```

**Response:**
```json
{
  "reply": "agent reply text",
  "actions_taken": ["Updated toxicity threshold to 0.7", "..."]
}
```

**Flow:**

```mermaid
graph TD
    REQ[POST /chat\nsection_id · message · history]
    REQ --> MCP[mcp_server.fetch_section_settings\nsection settings + name + status]
    MCP --> INPUTS[Build inputs\ncurrent_state · history_text · user_message]
    INPUTS --> CC[ChatCrew.kickoff\nmanager agent]

    CC --> RT[fetch_section_settings\nfetch_recent_comments\nvia mcp_adapter]
    CC --> WT[update_section\nupdate_comment_status\ntrigger_intel_report\nvia mcp_adapter]

    CC --> RAW[Raw agent output\nreply text + ACTIONS JSON]
    RAW --> PARSE{Contains ACTIONS:?}
    PARSE -->|yes| SPLIT[Split on ACTIONS:\nreply + JSON array]
    PARSE -->|no| PASSTHROUGH[reply = full output\nactions = empty list]
    SPLIT --> OUT[Return ChatResponse]
    PASSTHROUGH --> OUT

    style MCP fill:#f3e5f5,stroke:#6a1b9a
    style CC fill:#fff3e0,stroke:#e65100
    style WT fill:#fce4ec,stroke:#c62828
```

---

### 3.4 `POST /generate-report`

Internal endpoint called by `trigger_intel_report` (MCP tool). Runs `AnalystCrew` as a FastAPI `BackgroundTask` and returns `202` immediately. The crew fetches 7 days of analytics, reads top comments, writes a Markdown report to the database, and marks the row `completed`.

**Request:**
```json
{ "section_id": "uuid", "report_id": "uuid" }
```

**Response:** `{ "status": "processing", "report_id": "uuid" }` (202)

**Flow:**

```mermaid
graph TD
    REQ[POST /generate-report\nsection_id · report_id]
    REQ --> BG[FastAPI BackgroundTask\n_run_analyst spawned]
    REQ --> R202[Return 202 immediately]

    BG --> AC[AnalystCrew.kickoff\nanalyst agent]
    AC --> T1[fetch_weekly_analytics\n7-day daily view]
    AC --> T2[fetch_top_comments\n20 approved desc]
    AC --> T3[update_report_status\nsave Markdown + mark completed]

    AC -->|exception| ERR[update_report_status\nstatus=completed\ncontent=error message]
    ERR --> UNBLOCK[Section unblocked\nfor future reports]

    style BG fill:#e8f5e9,stroke:#2e7d32
    style AC fill:#f3e5f5,stroke:#6a1b9a
    style ERR fill:#ffcdd2,stroke:#c62828
```

> **Why no LangGraph here?** Report generation is a linear single-pass job: fetch → analyse → write. There's no branching, no retry logic, no human escalation. A direct `BackgroundTask` call is simpler and faster.

---

## 4. MCP — The Tool Layer

MCP (`tools/mcp_server.py`) is the **single source of truth for every database operation in the service**. Every tool is defined here as a `@mcp.tool()` decorated plain Python function. Nothing bypasses it — not the agents, not the API itself.

Three consumers, one tool layer:

- **CrewAI agents** — call MCP functions in-process through `mcp_adapter.py`
- **`main.py` directly** — calls `fetch_section_settings` and `update_report_status` as regular imports for pre-flight data fetching and error recovery
- **External clients** — the same FastMCP instance runs as an SSE server on port 8001, letting Claude Desktop, Cursor, or any MCP-compatible client discover and call all 9 tools

```mermaid
graph TD
    subgraph Internal
        MAIN[main.py\nfetch_section_settings\nupdate_report_status]
        CA[CrewAI Agents]
        ADP[mcp_adapter.py\nMCPTool wrappers]
        CA --> ADP
        ADP -->|direct in-process call| MCP
        MAIN -->|direct import| MCP
    end

    subgraph External
        CD[Claude Desktop]
        CUR[Cursor IDE]
        CD -->|SSE :8001| MCP
        CUR -->|SSE :8001| MCP
    end

    MCP[mcp_server.py\nFastMCP — komently-tools\n9 registered tools]
    MCP --> DB[(Supabase)]

    style MCP fill:#f3e5f5,stroke:#6a1b9a
    style MAIN fill:#e8f5e9,stroke:#2e7d32
```

### The 9 Tools

| Tool | Operation | Table |
|---|---|---|
| `fetch_section_settings` | Read | `comment_sections` |
| `fetch_recent_comments` | Read | `comments` |
| `update_comment_status` | Write | `comments` |
| `update_section` | Write | `comment_sections` |
| `fetch_parent_thread` | Read | `comments` |
| `trigger_intel_report` | Insert + HTTP ping | `section_reports` |
| `fetch_weekly_analytics` | Read | `section_analytics_daily` |
| `fetch_top_comments` | Read | `comments` |
| `update_report_status` | Write | `section_reports` |

### The Adapter

`mcp_adapter.py` wraps each MCP tool as a `CrewAI BaseTool` instance. The `MCPTool` class looks up the function by name from a registry and calls it directly — no HTTP, no protocol overhead for internal calls.

```python
class MCPTool(BaseTool):
    mcp_tool_name: str

    def _run(self, **kwargs) -> str:
        return _TOOL_REGISTRY[self.mcp_tool_name](**kwargs)
```

---

## 5. CrewAI — The Agent Layer

Three crews are defined in `crew.py`. All tool access goes through `mcp_adapter.py`.

### 5.1 ModerationCrew

Hierarchical process. Three specialist agents each evaluate the comment independently; a Manager LLM synthesises their findings into a single JSON verdict. The task description embeds the comment text multiple times to ensure the Manager always includes it in every delegation — preventing agents from searching for the comment instead of evaluating the one given to them.

```mermaid
graph TD
    KICK[crew.kickoff\nmoderation_task] --> MGR[Manager LLM\ngpt-4o-mini\narbitrator]

    MGR -->|delegate + comment text| SPA[spam_agent\nblacklist · patterns · links]
    MGR -->|delegate + comment text| TOX[toxicity_agent\nscoring · slurs · threats]
    MGR -->|delegate + comment text| CTX[context_agent\nthread coherence · off-topic]

    SPA --> T1[fetch_section_settings\nfetch_recent_comments]
    TOX --> T2[fetch_section_settings]
    CTX --> T3[fetch_section_settings\nfetch_parent_thread]

    SPA -->|spam verdict| MGR
    TOX -->|toxicity score| MGR
    CTX -->|coherence verdict| MGR

    MGR --> OUT[JSON Verdict\nstatus · toxicityScore · isSpam\nsentimentScore · confidence · reason]

    style MGR fill:#c8e6c9,stroke:#2e7d32
    style SPA fill:#e3f2fd,stroke:#1565c0
    style TOX fill:#e3f2fd,stroke:#1565c0
    style CTX fill:#e3f2fd,stroke:#1565c0
```

**Output schema:**
```json
{
  "status": "approved | flagged | rejected | shadow_hidden",
  "action": "approved | flagged | rejected | shadow_hidden",
  "toxicityScore": 0.0,
  "isSpam": false,
  "sentimentScore": 0.0,
  "confidence": 1.0,
  "reason": "brief explanation"
}
```

### 5.2 ChatCrew

A single manager agent with full read/write tool access. Called directly from `main.py`.

```mermaid
graph TD
    KICK[crew.kickoff\nchat_task] --> MAN[manager agent\nModerator Copilot]

    MAN --> R[fetch_section_settings\nfetch_recent_comments]
    MAN --> W[update_section\nupdate_comment_status]
    MAN --> T[trigger_intel_report]

    MAN --> OUT[Reply text + ACTIONS list]

    style MAN fill:#fff3e0,stroke:#e65100
```

### 5.3 AnalystCrew

A single analyst agent that runs as a FastAPI `BackgroundTask`.

```mermaid
graph TD
    KICK[crew.kickoff\nreport_task] --> ANL[analyst agent]

    ANL --> T1[fetch_weekly_analytics\n7-day daily view]
    ANL --> T2[fetch_top_comments\n20 approved · newest first]
    ANL --> T3[update_report_status\nsave Markdown + mark completed]

    style ANL fill:#f3e5f5,stroke:#6a1b9a
```

---

## 6. LangGraph — The Moderation Lifecycle

LangGraph manages the **stateful lifecycle** of a single comment. It is used exclusively for `POST /moderate`.

### 6.1 State

```
GraphState
├── input            — comment body (from API)
├── section_id       — section UUID (from API)
├── history          — reserved for future multi-turn use
├── toxicity_score   — written by moderation/deep_review nodes
├── confidence       — written by moderation/deep_review nodes
├── retry_count      — written by retry_node
├── escalation_reason— written by moderation_node
├── crew_output      — final parsed JSON verdict
├── final_response   — raw string output from crew
└── metadata         — comment_id · parent_id · origin
```

### 6.2 Graph Topology

```mermaid
graph TD
    START([START]) --> MN[moderation_node\nrun ModerationCrew]
    MN --> RO{route_on_output}

    RO -->|isSpam = true| FN
    RO -->|confidence < 0.5\nretry_count < 2| RT[retry_node\n+1 retry_count]
    RO -->|confidence < 0.5\nretry_count ≥ 2| FN
    RO -->|toxicity > 0.7| ES[escalate_node\ninterrupt — human review]
    RO -->|0.3 – 0.7| DR[deep_review_node\nre-run strict mode]
    RO -->|toxicity < 0.3\nno spam| AA[auto_approve_node]

    RT -->|cycle max 2×| MN
    DR --> FN[finalize_node]
    ES --> FN
    AA --> FN
    FN --> END([END])

    style RO fill:#fff9c4,stroke:#f9a825
    style ES fill:#ffcdd2,stroke:#c62828
    style DR fill:#ffe0b2,stroke:#e65100
    style AA fill:#c8e6c9,stroke:#2e7d32
    style RT fill:#e3f2fd,stroke:#1565c0
```

### 6.3 Routing Logic

| Condition | Route | What happens |
|---|---|---|
| `isSpam = true` | → `finalize` | Crew already decided — verdict passes through unchanged |
| `confidence < 0.5` and `retry_count < 2` | → `retry_node` | Increment counter, re-run crew |
| `confidence < 0.5` and `retry_count ≥ 2` | → `finalize` | Give up, pass last verdict through |
| `toxicity > 0.7` | → `escalate_node` | Pause graph, notify moderator |
| `0.3 ≤ toxicity ≤ 0.7` | → `deep_review_node` | Re-run with stricter prompt |
| `toxicity < 0.3` and no spam | → `auto_approve_node` | Fast-approve |

### 6.4 `finalize_node` Fallback Chain

```mermaid
graph TD
    FN[finalize_node]
    FN --> TRY1{Parse final_response\nas JSON}
    TRY1 -->|success| OK[Return parsed verdict]
    TRY1 -->|fail| TRY2{Parse crew_output\nas JSON}
    TRY2 -->|success| WARN1[Log warning\nReturn crew_output]
    TRY2 -->|fail| WARN2[Log warning\nReturn safe flagged default\nconfidence=0.0]

    style WARN2 fill:#ffcdd2,stroke:#c62828
```

### 6.5 Human Escalation Flow

```mermaid
graph TD
    ES[escalate_node\ncalls interrupt payload] -->|GraphInterrupt raised| API[API catches GraphInterrupt\nextracts toxicity_score from payload]
    API --> RET[Returns flagged verdict\n+ pending_thread_id in metadata]
    RET --> MOD[Dashboard Moderator\nreviews comment]
    MOD -->|PATCH /moderate/thread_id/resume\nbody: status=approved or rejected| CMD[Command resume=status]
    CMD --> RESUME[Graph resumes from checkpoint\nescalate_node continues]
    RESUME --> FIN[finalize_node → Final verdict]

    style ES fill:#ffcdd2,stroke:#c62828
    style MOD fill:#e8f5e9,stroke:#2e7d32
```

---

## 7. Deployment

Both the FastAPI app and the MCP server run inside the **same Railway container**. `start.sh` launches the MCP server as a background process on port 8001, waits for the port to open, then starts FastAPI on the Railway-assigned `$PORT`.

```mermaid
graph TD
    subgraph Railway Container
        SH[start.sh]
        SH -->|background| MCPS[MCP Server\nlocalhost:8001\ninternal only]
        SH -->|foreground| FAPI[FastAPI\n0.0.0.0 PORT\npublic]
        FAPI -->|in-process| MCPS
    end

    INET[Internet] --> FAPI
    EXT[Claude Desktop\nCursor] -->|SSE| MCPS
    MCPS --> SB[(Supabase Cloud)]
```

---

## 8. File Map

| File | Role |
|---|---|
| `main.py` | FastAPI app — 4 endpoints, lifespan, error handling; imports MCP tools directly |
| `graph.py` | LangGraph moderation workflow — state, nodes, routing, fallback chain |
| `crew.py` | CrewAI crew definitions — ModerationCrew, ChatCrew, AnalystCrew |
| `tools/mcp_server.py` | **Single source of truth** — all 9 tool implementations + SSE transport |
| `tools/mcp_adapter.py` | MCPTool wrappers — bridges CrewAI BaseTool → MCP functions in-process |
| `config/agents.yaml` | Agent roles, goals, and backstories |
| `config/tasks.yaml` | Task descriptions and expected output formats |
| `railway.toml` | Railway build and deploy configuration |
| `nixpacks.toml` | Nixpacks build phases — Python 3.12, pip install |
| `start.sh` | Process launcher — MCP server then FastAPI |
| `claude_desktop_config.json` | MCP connection config for Claude Desktop / Cursor |

---

## 9. Full System Diagram

```mermaid
graph TD
    %% Entry points
    COM[New Comment\nPOST /moderate] --> API
    OWN[Dashboard Owner\nPOST /chat] --> API
    HUM[Human Moderator\nPATCH /moderate/id/resume] --> API
    EXT[Claude Desktop\nCursor] -->|SSE :8001| MCPS

    %% API
    API[FastAPI\nmain.py]

    %% LangGraph
    API -->|komently_app.invoke| LG_MN

    subgraph LangGraph [LangGraph — Moderation Lifecycle]
        LG_MN[moderation_node]
        LG_RO{route_on_output}
        LG_RT[retry_node]
        LG_DR[deep_review_node]
        LG_ES[escalate_node\ninterrupt]
        LG_AA[auto_approve_node]
        LG_FN[finalize_node\nfallback chain]

        LG_MN --> LG_RO
        LG_RO -->|spam| LG_FN
        LG_RO -->|low confidence| LG_RT
        LG_RO -->|toxicity > 0.7| LG_ES
        LG_RO -->|borderline| LG_DR
        LG_RO -->|clean| LG_AA
        LG_RT --> LG_MN
        LG_DR --> LG_FN
        LG_ES --> LG_FN
        LG_AA --> LG_FN
    end

    %% CrewAI
    LG_MN -->|kickoff| MOD
    LG_DR -->|kickoff strict| MOD
    API -->|direct kickoff| CHAT
    API -->|BackgroundTask kickoff| ANAL

    subgraph CrewAI [CrewAI — Agent Crews]
        subgraph MOD [ModerationCrew — hierarchical]
            MMGR[Manager LLM]
            SPA[spam_agent]
            TOX[toxicity_agent]
            CTX[context_agent]
            SPA --> MMGR
            TOX --> MMGR
            CTX --> MMGR
        end
        subgraph CHAT [ChatCrew — sequential]
            MAN[manager agent]
        end
        subgraph ANAL [AnalystCrew — sequential]
            ANL[analyst agent]
        end
    end

    %% MCP adapter → MCP server
    SPA -->|mcp_adapter| MCPS
    TOX -->|mcp_adapter| MCPS
    CTX -->|mcp_adapter| MCPS
    MAN -->|mcp_adapter| MCPS
    ANL -->|mcp_adapter| MCPS

    %% main.py also calls MCP directly
    API -->|fetch_section_settings\ndirect import| MCPS
    API -->|update_report_status\nerror recovery| MCPS

    %% MCP server
    MCPS[mcp_server.py\nFastMCP — 9 tools\nsingle source of truth]
    MCPS --> DB[(Supabase)]

    %% Escalation
    LG_ES -->|GraphInterrupt| API
    API -->|flagged + thread_id| OWN

    %% Outputs
    LG_FN --> API
    CHAT --> API
    ANAL -->|202| API

    style LG_MN fill:#e3f2fd,stroke:#1565c0
    style LG_RO fill:#fff9c4,stroke:#f9a825
    style LG_ES fill:#ffcdd2,stroke:#c62828
    style LG_DR fill:#ffe0b2,stroke:#e65100
    style LG_AA fill:#c8e6c9,stroke:#2e7d32
    style MMGR fill:#c8e6c9,stroke:#2e7d32
    style MCPS fill:#f3e5f5,stroke:#6a1b9a
    style DB  fill:#fafafa,stroke:#546e7a
```

---

*May 2026*
