"""
CrewAI ↔ MCP bridge.

MCPTool is a generic BaseTool subclass that forwards every _run() call to
the Komently MCP server via SSE transport.  Tool-specific Pydantic schemas
are defined here and injected at instantiation so the LLM still receives
accurate parameter descriptions.

MCP server URL: MCP_SERVER_URL env var (default: http://localhost:8001/sse)
"""

import asyncio
import concurrent.futures
import json
import os
from typing import Optional, Type

from crewai.tools import BaseTool
from mcp import ClientSession
from mcp.client.sse import sse_client
from pydantic import BaseModel, Field

MCP_SERVER_URL = os.environ.get("MCP_SERVER_URL", "http://localhost:8001/sse")

_executor = concurrent.futures.ThreadPoolExecutor(max_workers=8, thread_name_prefix="mcp")


def _run_sync(coro):
    """Execute an async coroutine in a dedicated thread with its own event loop.
    Safe to call from both sync code and inside an existing async event loop."""
    def _in_thread():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()

    return _executor.submit(_in_thread).result()


async def _call_mcp(tool_name: str, args: dict) -> str:
    async with sse_client(MCP_SERVER_URL) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, args)
            if result.content:
                return result.content[0].text
            return json.dumps({"error": "Empty response from MCP server"})


# ── Generic adapter ───────────────────────────────────────────────────────────

class MCPTool(BaseTool):
    """A CrewAI tool that proxies every call to an MCP server tool."""
    name: str
    description: str
    mcp_tool_name: str
    args_schema: Optional[Type[BaseModel]] = None

    def _run(self, **kwargs) -> str:
        return _run_sync(_call_mcp(self.mcp_tool_name, kwargs))


# ── Input schemas ─────────────────────────────────────────────────────────────

class FetchSectionSettingsInput(BaseModel):
    section_id: str = Field(description="UUID of the comment section")

class FetchRecentCommentsInput(BaseModel):
    section_id: str = Field(description="UUID of the comment section")
    limit: int = Field(default=20, description="Max number of recent comments to retrieve (max 50)")

class UpdateCommentStatusInput(BaseModel):
    comment_id: str = Field(description="UUID of the comment to update")
    status: str = Field(description="New moderation status: 'approved' or 'flagged'")

class UpdateSectionInput(BaseModel):
    section_id: str = Field(description="UUID of the comment section")
    status: str = Field(default=None, description="Set section status: 'active' or 'paused'. Optional.")
    settings_json: str = Field(
        default=None,
        description=(
            "JSON string of settings to merge. Supported keys: max_chars, blacklist, "
            "ai_moderation_enabled, ai_toxicity_threshold, spam_guard_enabled, "
            "context_analyzer_enabled, sentiment_analysis_enabled, auto_action_strikes."
        ),
    )

class FetchParentThreadInput(BaseModel):
    comment_id: str = Field(description="UUID of the parent comment")

class TriggerIntelReportInput(BaseModel):
    section_id: str = Field(description="UUID of the comment section")

class FetchWeeklyAnalyticsInput(BaseModel):
    section_id: str = Field(description="UUID of the comment section")

class FetchTopCommentsInput(BaseModel):
    section_id: str = Field(description="UUID of the comment section")

class UpdateReportStatusInput(BaseModel):
    report_id: str = Field(description="UUID of the report to update")
    content: str = Field(description="The finalized Markdown content of the report.")


# ── Pre-built tool instances (drop-in replacements for the old BaseTool classes) ──

FetchSectionSettingsTool = MCPTool(
    name="fetch_section_settings",
    description=(
        "Fetch the settings (max_chars, blacklist, ai_moderation_enabled, "
        "ai_toxicity_threshold) for a given comment section."
    ),
    mcp_tool_name="fetch_section_settings",
    args_schema=FetchSectionSettingsInput,
)

FetchRecentCommentsTool = MCPTool(
    name="fetch_recent_comments",
    description=(
        "Fetch recent comments for a section. Returns comment body, "
        "moderation_status, toxicity_score, is_spam, and created_at."
    ),
    mcp_tool_name="fetch_recent_comments",
    args_schema=FetchRecentCommentsInput,
)

UpdateCommentStatusTool = MCPTool(
    name="update_comment_status",
    description="Update the moderation_status of a specific comment to 'approved' or 'flagged'.",
    mcp_tool_name="update_comment_status",
    args_schema=UpdateCommentStatusInput,
)

UpdateSectionTool = MCPTool(
    name="update_section",
    description=(
        "Update section status ('active' or 'paused') and/or merge new settings "
        "via a JSON string. Use this to change moderation thresholds, toggle spam guard, "
        "or completely halt comment ingestion."
    ),
    mcp_tool_name="update_section",
    args_schema=UpdateSectionInput,
)

FetchParentThreadTool = MCPTool(
    name="fetch_parent_thread",
    description="Fetch a specific parent comment by its UUID to understand the context of a reply.",
    mcp_tool_name="fetch_parent_thread",
    args_schema=FetchParentThreadInput,
)

TriggerIntelReportTool = MCPTool(
    name="trigger_intel_report",
    description=(
        "Trigger the Senior Data Analyst agent to generate a fresh 7-day Intel Report "
        "and Markdown Executive Summary for the specified section. Use this if the user asks for a report, metrics, or analysis."
    ),
    mcp_tool_name="trigger_intel_report",
    args_schema=TriggerIntelReportInput,
)

FetchWeeklyAnalyticsTool = MCPTool(
    name="fetch_weekly_analytics",
    description="Fetch daily comment volume and moderation status counts for the last 7 days.",
    mcp_tool_name="fetch_weekly_analytics",
    args_schema=FetchWeeklyAnalyticsInput,
)

FetchTopCommentsTool = MCPTool(
    name="fetch_top_comments",
    description="Fetch the top most discussed or interacted comments from the past week.",
    mcp_tool_name="fetch_top_comments",
    args_schema=FetchTopCommentsInput,
)

UpdateReportStatusTool = MCPTool(
    name="update_report_status",
    description="Push the final compiled Markdown report to the database, setting its status to completed.",
    mcp_tool_name="update_report_status",
    args_schema=UpdateReportStatusInput,
)
