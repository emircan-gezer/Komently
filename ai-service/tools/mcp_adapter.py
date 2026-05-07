"""
CrewAI ↔ MCP bridge — in-process edition.

All tool logic lives in mcp_server.py, registered with the FastMCP instance.
The @mcp.tool() decorator keeps each function as a regular Python callable,
so we import and invoke them directly — no HTTP, no threading hack.

The same functions are simultaneously exposed over SSE for external AI clients
(Claude Desktop, Cursor) via the MCP server running on port 8001.

Call path (internal):   CrewAI agent → MCPTool._run() → mcp_server.<fn>() → Supabase
Call path (external):   Claude Desktop → SSE :8001 → FastMCP → mcp_server.<fn>() → Supabase
"""

from typing import Optional, Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

# Import every tool function directly from the MCP server module.
# @mcp.tool() registers them with FastMCP but leaves them as normal callables.
from tools.mcp_server import (
    fetch_section_settings,
    fetch_recent_comments,
    update_comment_status,
    update_section,
    fetch_parent_thread,
    trigger_intel_report,
    fetch_weekly_analytics,
    fetch_top_comments,
    update_report_status,
)

# Registry used by MCPTool to resolve function by name at call time
_TOOL_REGISTRY: dict = {
    "fetch_section_settings":  fetch_section_settings,
    "fetch_recent_comments":   fetch_recent_comments,
    "update_comment_status":   update_comment_status,
    "update_section":          update_section,
    "fetch_parent_thread":     fetch_parent_thread,
    "trigger_intel_report":    trigger_intel_report,
    "fetch_weekly_analytics":  fetch_weekly_analytics,
    "fetch_top_comments":      fetch_top_comments,
    "update_report_status":    update_report_status,
}


# ── Generic adapter ───────────────────────────────────────────────────────────

class MCPTool(BaseTool):
    """
    A CrewAI BaseTool that calls an MCP-registered function in-process.
    Schema and description are still defined here so the LLM receives
    accurate parameter guidance, consistent with what MCP exposes externally.
    """
    name: str
    description: str
    mcp_tool_name: str
    args_schema: Optional[Type[BaseModel]] = None

    def _run(self, **kwargs) -> str:
        fn = _TOOL_REGISTRY[self.mcp_tool_name]
        return fn(**kwargs)


# ── Input schemas ─────────────────────────────────────────────────────────────

class FetchSectionSettingsInput(BaseModel):
    section_id: str = Field(description="UUID of the comment section")

class FetchRecentCommentsInput(BaseModel):
    section_id: str = Field(description="UUID of the comment section")
    limit: int = Field(default=20, description="Max comments to retrieve (max 50)")

class UpdateCommentStatusInput(BaseModel):
    comment_id: str = Field(description="UUID of the comment to update")
    status: str = Field(description="New status: 'approved', 'flagged', 'rejected', or 'shadow_hidden'")

class UpdateSectionInput(BaseModel):
    section_id: str = Field(description="UUID of the comment section")
    status: str = Field(default=None, description="'active' or 'paused'. Optional.")
    settings_json: str = Field(
        default=None,
        description=(
            "JSON string of settings to merge. Keys: max_chars, blacklist, "
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
    content: str = Field(description="Finalized Markdown content of the report")


# ── Pre-built tool instances ──────────────────────────────────────────────────

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
        "Fetch recent comments for a section. Returns body, "
        "moderation_status, toxicity_score, is_spam, and created_at."
    ),
    mcp_tool_name="fetch_recent_comments",
    args_schema=FetchRecentCommentsInput,
)

UpdateCommentStatusTool = MCPTool(
    name="update_comment_status",
    description="Update the moderation_status of a comment. Valid values: 'approved', 'flagged', 'rejected', 'shadow_hidden'.",
    mcp_tool_name="update_comment_status",
    args_schema=UpdateCommentStatusInput,
)

UpdateSectionTool = MCPTool(
    name="update_section",
    description=(
        "Update section status ('active' or 'paused') and/or merge new settings. "
        "Use to change moderation thresholds, toggle spam guard, or halt ingestion."
    ),
    mcp_tool_name="update_section",
    args_schema=UpdateSectionInput,
)

FetchParentThreadTool = MCPTool(
    name="fetch_parent_thread",
    description="Fetch a parent comment by UUID to understand the context of a reply.",
    mcp_tool_name="fetch_parent_thread",
    args_schema=FetchParentThreadInput,
)

TriggerIntelReportTool = MCPTool(
    name="trigger_intel_report",
    description=(
        "Trigger the Analyst agent to generate a fresh 7-day Intel Report. "
        "Use when the user asks for a report, metrics, or analysis."
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
    description="Fetch the top discussed/approved comments from the past week.",
    mcp_tool_name="fetch_top_comments",
    args_schema=FetchTopCommentsInput,
)

UpdateReportStatusTool = MCPTool(
    name="update_report_status",
    description="Save the finalized Markdown report to the database and mark it completed.",
    mcp_tool_name="update_report_status",
    args_schema=UpdateReportStatusInput,
)
