# ai-service/tools/analyst_tools.py
import json
from datetime import datetime, timedelta
from typing import Type
from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from tools.supabase_tools import _get_client

# ── Fetch Last 7 Days Analytics ───────────────────────────────────────────────

class FetchWeeklyAnalyticsInput(BaseModel):
    section_id: str = Field(description="UUID of the comment section")

class FetchWeeklyAnalyticsTool(BaseTool):
    name: str = "fetch_weekly_analytics"
    description: str = "Fetch daily comment volume and moderation status counts for the last 7 days."
    args_schema: Type[BaseModel] = FetchWeeklyAnalyticsInput

    def _run(self, section_id: str) -> str:
        sb = _get_client()
        seven_days_ago = (datetime.now() - timedelta(days=7)).date().isoformat()
        
        # Query the daily view we created
        resp = (
            sb.table("section_analytics_daily")
            .select("*")
            .eq("section_id", section_id)
            .gte("date", seven_days_ago)
            .order("date", desc=True)
            .execute()
        )
        return json.dumps(resp.data or [], default=str)

# ── Fetch Top Comments ────────────────────────────────────────────────────────

class FetchTopCommentsInput(BaseModel):
    section_id: str = Field(description="UUID of the comment section")

class FetchTopCommentsTool(BaseTool):
    name: str = "fetch_top_comments"
    description: str = "Fetch the top most discussed or interacted comments from the past week."
    args_schema: Type[BaseModel] = FetchTopCommentsInput

    def _run(self, section_id: str) -> str:
        sb = _get_client()
        seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()
        
        # Just grab 20 recent approved comments as a proxy for "top" discussion trends
        resp = (
            sb.table("comments")
            .select("body, toxicity_score, created_at, commenters(username)")
            .eq("section_id", section_id)
            .eq("moderation_status", "approved")
            .gte("created_at", seven_days_ago)
            .limit(20)
            .execute()
        )
        return json.dumps(resp.data or [], default=str)

# ── Update Report Status ──────────────────────────────────────────────────────

class UpdateReportStatusInput(BaseModel):
    report_id: str = Field(description="UUID of the report to update")
    content: str = Field(description="The finalized Markdown content of the report.")

class UpdateReportStatusTool(BaseTool):
    name: str = "update_report_status"
    description: str = "Push the final compiled Markdown report to the database, setting its status to completed."
    args_schema: Type[BaseModel] = UpdateReportStatusInput

    def _run(self, report_id: str, content: str) -> str:
        sb = _get_client()
        resp = (
            sb.table("section_reports")
            .update({
                "status": "completed",
                "report_content": content,
                "completed_at": datetime.now().isoformat()
            })
            .eq("id", report_id)
            .execute()
        )
        if resp.data:
            return json.dumps({"success": True})
        return json.dumps({"error": "Failed to save report"})
