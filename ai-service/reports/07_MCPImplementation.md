# MCP Implementation Report
## Komently AI Service

**Author:** Emircan Gezer
**Date:** May 5, 2026

---

## 1. Overview

This report documents how **Model Context Protocol (MCP)** is integrated into the Komently AI service as the tool layer, sitting between **CrewAI agents** and the **Supabase database** — without replacing or modifying the existing LangGraph or CrewAI architecture.

The three frameworks now have distinct, non-overlapping responsibilities:

| Framework | Responsibility |
|-----------|---------------|
| **LangGraph** | Routes requests, manages shared state, standardises outputs |
| **CrewAI** | Defines agents, tasks, and crew orchestration |
| **MCP** | Exposes all database tools as a self-describing protocol server |

---

## 2. Full Architecture

```mermaid
graph TD
    A[FastAPI Endpoint] --> B[LangGraph Graph]
    B --> C{Router Node}
    C -->|moderation| D[ModerationCrew]
    C -->|chat| E[ChatCrew]
    C -->|analyst| F[AnalystCrew]
    D --> G[MCPTool Adapter]
    E --> G
    F --> G
    G -->|SSE over HTTP| H[MCP Server :8001]
    H --> I[(Supabase DB)]
    G --> J[Finalize Node]
    J --> K[API Response]
```

Both the FastAPI app and the MCP server run inside the same container. The MCP server is bound to `localhost:8001` and is never publicly exposed — it is an internal process only reachable by the FastAPI process.

---

## 3. What Changed vs. What Stayed the Same

```mermaid
graph TD
    subgraph Unchanged
        A[graph.py]
        B[main.py]
        C[config/agents.yaml]
        D[config/tasks.yaml]
        E[crew.py - agents and tasks]
    end

    subgraph Changed
        F[crew.py - imports only]
    end

    subgraph New
        G[tools/mcp_server.py]
        H[tools/mcp_adapter.py]
        I[start.sh]
        J[railway.toml]
        K[nixpacks.toml]
    end

    F -->|imports from| H
    H -->|calls| G
```

The only modification to existing files is **three import lines** in `crew.py`. Everything else — graph topology, crew definitions, agent configs, task configs, and API endpoints — is completely untouched.

---

## 4. MCP Server — `tools/mcp_server.py`

The server is built with `FastMCP` and exposes all nine tools as decorated functions over **SSE (Server-Sent Events) transport** on port 8001.

```mermaid
graph TD
    A[FastMCP - komently-tools] --> B[fetch_section_settings]
    A --> C[fetch_recent_comments]
    A --> D[update_comment_status]
    A --> E[update_section]
    A --> F[fetch_parent_thread]
    A --> G[trigger_intel_report]
    A --> H[fetch_weekly_analytics]
    A --> I[fetch_top_comments]
    A --> J[update_report_status]

    B --> K[(comment_sections)]
    C --> L[(comments)]
    D --> L
    E --> K
    F --> L
    G --> M[(section_reports)]
    H --> N[(section_analytics_daily)]
    I --> L
    J --> M
```

Each function is a plain Python function decorated with `@mcp.tool()`. MCP auto-generates the JSON schema for the LLM from the type annotations and docstring — no Pydantic model boilerplate needed on the server side.

### Tool Groupings

| Group | Tools | Tables accessed |
|-------|-------|-----------------|
| Read | `fetch_section_settings`, `fetch_recent_comments`, `fetch_parent_thread`, `fetch_weekly_analytics`, `fetch_top_comments` | Read-only |
| Write | `update_comment_status`, `update_section`, `update_report_status` | Write |
| Trigger | `trigger_intel_report` | Insert + HTTP fire-and-forget |

---

## 5. MCP Adapter — `tools/mcp_adapter.py`

The adapter is the bridge between CrewAI and the MCP server. It has three responsibilities:

1. Define a generic `MCPTool(BaseTool)` that forwards any `_run()` call to the MCP server via SSE
2. Define the Pydantic input schemas so the LLM receives accurate parameter descriptions
3. Export pre-instantiated tool objects under the original names so `crew.py` needs no structural changes

```mermaid
graph TD
    A[CrewAI Agent] -->|calls _run kwargs| B[MCPTool - BaseTool]
    B --> C[_run_sync helper]
    C --> D[New thread - own event loop]
    D --> E[_call_mcp coroutine]
    E -->|SSE connect| F[ClientSession]
    F -->|session.call_tool| G[MCP Server :8001]
    G --> H[Tool result JSON]
    H --> F
    F --> E
    E --> D
    D --> C
    C --> B
    B -->|returns str| A
```

### Thread-Safety

FastAPI runs on an async event loop. CrewAI calls tools synchronously inside that loop. Using `asyncio.run()` from inside an existing event loop raises a `RuntimeError`. The adapter solves this by always dispatching to a **dedicated `ThreadPoolExecutor`** where each worker creates its own isolated event loop:

```mermaid
graph TD
    A[FastAPI async event loop] --> B[MCPTool._run - sync]
    B --> C[ThreadPoolExecutor - 8 workers]
    C --> D[Thread 1 - new event loop]
    C --> E[Thread 2 - new event loop]
    C --> F[Thread N - new event loop]
    D --> G[MCP SSE call]
    E --> G
    F --> G
```

This means multiple agents running concurrently each get their own MCP connection without blocking the main event loop.

---

## 6. Tool Call Flow — End to End

```mermaid
graph TD
    A[POST /moderate] --> B[komently_app.invoke]
    B --> C[Router - GPT-4o-mini]
    C --> D[ModerationCrew.kickoff]
    D --> E[Fetcher agent]
    E --> F[fetch_section_settings - MCPTool]
    F --> G[_run_sync - new thread]
    G --> H[SSE connect to :8001]
    H --> I[MCP Server calls _get_client]
    I --> J[(Supabase)]
    J --> I
    I --> H
    H --> G
    G --> F
    F --> E
    E --> K[fetch_recent_comments - MCPTool]
    K -.->|same path| J
    E --> L[Manager agent]
    L --> M[update_comment_status - MCPTool]
    M -.->|same path| J
    L --> N[Moderator agent - no tools]
    N --> O[Finalize Node]
    O --> P[API Response]
```

---

## 7. Railway Deployment

On Railway, a **single service** runs both processes. The startup script (`start.sh`) launches the MCP server as a background process, waits for its port to open, then starts the FastAPI app in the foreground bound to the Railway-assigned `$PORT`.

```mermaid
graph TD
    A[Railway Service Container] --> B[start.sh]
    B --> C[python -m tools.mcp_server - background]
    B --> D{Port 8001 open?}
    D -->|polling every 1s| D
    D -->|yes| E[uvicorn main:app - foreground]
    C --> F[MCP Server - localhost:8001 - internal only]
    E --> G[FastAPI App - 0.0.0.0 PORT - public]
    G --> F
```

### Network Boundaries

```mermaid
graph TD
    subgraph Internet
        A[External Clients]
    end

    subgraph Railway Container
        B[FastAPI - public PORT]
        C[MCP Server - localhost:8001]
        B --> C
    end

    subgraph Supabase Cloud
        D[(Database)]
    end

    A --> B
    C --> D
```

The MCP server has **no public route**. Only the FastAPI process can reach it. Supabase is accessed from the MCP server using the service-role key stored as a Railway environment variable.

### Environment Variables

| Variable | Where set | Purpose |
|----------|-----------|---------|
| `SUPABASE_URL` | Railway dashboard | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Railway dashboard | DB admin key |
| `OPENAI_API_KEY` | Railway dashboard | LLM calls |
| `LANGSMITH_*` | Railway dashboard | Tracing (optional) |
| `MCP_SERVER_URL` | Railway dashboard | `http://localhost:8001/sse` |
| `MCP_SERVER_PORT` | Set by `start.sh` | `8001` |
| `PORT` | Set by Railway | FastAPI public port |

---

## 8. Key Files

| File | Role |
|------|------|
| `tools/mcp_server.py` | FastMCP server — all 9 tool implementations, SSE transport |
| `tools/mcp_adapter.py` | `MCPTool` class, Pydantic schemas, pre-built tool instances |
| `crew.py` | CrewAI definitions — only import block updated |
| `start.sh` | Process launcher — starts MCP server then FastAPI |
| `railway.toml` | Railway build and deploy configuration |
| `nixpacks.toml` | Nixpacks build phases — Python 3.12, pip install |
| `.env.example` | Documents all required environment variables |

---

## 9. Benefits of the MCP Layer

| Concern | Before MCP | After MCP |
|---------|-----------|-----------|
| Tool reuse | Coupled to CrewAI `BaseTool` only | Any MCP-compatible client can call the same tools |
| Boilerplate | Pydantic schema + `_run()` per tool | Just a typed function + docstring |
| Testability | Must instantiate a CrewAI tool to test | Tools are plain functions, callable in isolation |
| Observability | Tool calls visible only in CrewAI logs | MCP protocol layer adds a dedicated tracing point |
| Future extensibility | New consumers require new tool wrappers | New consumers connect to the existing MCP server |

---

*May 2026*
