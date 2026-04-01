# ai-service/tools/supabase_tools.py
# CrewAI Tool wrappers for Supabase database access.

import os
import json
from typing import Type
from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from supabase import create_client, Client

def _get_client() -> Client:
    """Return a Supabase admin client (service-role key)."""
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )


# ── Fetch Section Settings ────────────────────────────────────────────────────

class FetchSectionSettingsInput(BaseModel):
    section_id: str = Field(description="UUID of the comment section")

class FetchSectionSettingsTool(BaseTool):
    name: str = "fetch_section_settings"
    description: str = (
        "Fetch the settings (max_chars, blacklist, ai_moderation_enabled, "
        "ai_toxicity_threshold) for a given comment section."
    )
    args_schema: Type[BaseModel] = FetchSectionSettingsInput

    def _run(self, section_id: str) -> str:
        sb = _get_client()
        resp = sb.table("comment_sections").select("settings, name, status, public_id").eq("id", section_id).single().execute()
        if resp.data:
            return json.dumps(resp.data, default=str)
        return json.dumps({"error": "Section not found"})


# ── Fetch Recent Comments ─────────────────────────────────────────────────────

class FetchRecentCommentsInput(BaseModel):
    section_id: str = Field(description="UUID of the comment section")
    limit: int = Field(default=20, description="Max number of recent comments to retrieve (max 50)")

class FetchRecentCommentsTool(BaseTool):
    name: str = "fetch_recent_comments"
    description: str = (
        "Fetch recent comments for a section. Returns comment body, "
        "moderation_status, toxicity_score, is_spam, and created_at."
    )
    args_schema: Type[BaseModel] = FetchRecentCommentsInput

    def _run(self, section_id: str, limit: int = 20) -> str:
        limit = min(limit, 50)
        sb = _get_client()
        resp = (
            sb.table("comments")
            .select("id, body, moderation_status, toxicity_score, is_spam, created_at")
            .eq("section_id", section_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return json.dumps(resp.data or [], default=str)


# ── Update Comment Status ─────────────────────────────────────────────────────

class UpdateCommentStatusInput(BaseModel):
    comment_id: str = Field(description="UUID of the comment to update")
    status: str = Field(description="New moderation status: 'approved' or 'flagged'")

class UpdateCommentStatusTool(BaseTool):
    name: str = "update_comment_status"
    description: str = (
        "Update the moderation_status of a specific comment to 'approved' or 'flagged'."
    )
    args_schema: Type[BaseModel] = UpdateCommentStatusInput

    def _run(self, comment_id: str, status: str) -> str:
        if status not in ("approved", "flagged"):
            return json.dumps({"error": "status must be 'approved' or 'flagged'"})
        sb = _get_client()
        resp = (
            sb.table("comments")
            .update({"moderation_status": status})
            .eq("id", comment_id)
            .execute()
        )
        if resp.data:
            return json.dumps({"success": True, "updated": comment_id, "status": status})
        return json.dumps({"error": "Comment not found or update failed"})


# ── Update Section ───────────────────────────────────────────────────

class UpdateSectionInput(BaseModel):
    section_id: str = Field(description="UUID of the comment section")
    status: str = Field(default=None, description="Set section status: 'active' or 'paused'. Optional.")
    settings_json: str = Field(
        default=None,
        description=(
            "JSON string of settings to merge. Supported keys: max_chars, blacklist, "
            "ai_moderation_enabled, ai_toxicity_threshold, spam_guard_enabled, "
            "context_analyzer_enabled, sentiment_analysis_enabled, auto_action_strikes."
        )
    )

class UpdateSectionTool(BaseTool):
    name: str = "update_section"
    description: str = (
        "Update section status ('active' or 'paused') and/or merge new settings "
        "via a JSON string. Use this to change moderation thresholds, toggle spam guard, "
        "or completely halt comment ingestion."
    )
    args_schema: Type[BaseModel] = UpdateSectionInput

    def _run(self, section_id: str, status: str = None, settings_json: str = None) -> str:
        sb = _get_client()
        
        # Fetch current record
        current = sb.table("comment_sections").select("settings, status").eq("id", section_id).single().execute()
        if not current.data:
            return json.dumps({"error": "Section not found"})
        
        updates = {}
        if status in ("active", "paused"):
            updates["status"] = status
            
        if settings_json:
            try:
                new_settings = json.loads(settings_json)
                merged = {**(current.data.get("settings") or {}), **new_settings}
                updates["settings"] = merged
            except json.JSONDecodeError:
                return json.dumps({"error": "Invalid JSON in settings_json"})

        if not updates:
            return json.dumps({"error": "No valid updates provided. Provide status or settings_json."})

        resp = (
            sb.table("comment_sections")
            .update(updates)
            .eq("id", section_id)
            .execute()
        )
        if resp.data:
            return json.dumps({"success": True, "updated_fields": list(updates.keys())})
        return json.dumps({"error": "Failed to update section"})

# ── Fetch Parent Thread ───────────────────────────────────────────────────────

class FetchParentThreadInput(BaseModel):
    comment_id: str = Field(description="UUID of the parent comment")

class FetchParentThreadTool(BaseTool):
    name: str = "fetch_parent_thread"
    description: str = (
        "Fetch a specific parent comment by its UUID to understand the context of a reply."
    )
    args_schema: Type[BaseModel] = FetchParentThreadInput

    def _run(self, comment_id: str) -> str:
        sb = _get_client()
        resp = (
            sb.table("comments")
            .select("id, body, created_at, commenters(username)")
            .eq("id", comment_id)
            .single()
            .execute()
        )
        if resp.data:
            return json.dumps(resp.data, default=str)
        return json.dumps({"error": "Parent comment not found"})

# ── Trigger Intel Report ──────────────────────────────────────────────────────

import requests

class TriggerIntelReportInput(BaseModel):
    section_id: str = Field(description="UUID of the comment section")

class TriggerIntelReportTool(BaseTool):
    name: str = "trigger_intel_report"
    description: str = (
        "Trigger the Senior Data Analyst agent to generate a fresh 7-day Intel Report "
        "and Markdown Executive Summary for the specified section. Use this if the user asks for a report, metrics, or analysis."
    )
    args_schema: Type[BaseModel] = TriggerIntelReportInput

    def _run(self, section_id: str) -> str:
        sb = _get_client()
        
        # Check for active processing report
        active = sb.table("section_reports").select("id").eq("section_id", section_id).eq("status", "processing").execute()
        if active.data and len(active.data) > 0:
            return json.dumps({"error": "A report is already currently processing. Please tell the user to wait for it to finish."})
        
        # Insert new processing row
        resp = sb.table("section_reports").insert({"section_id": section_id, "status": "processing"}).execute()
        if not resp.data:
            return json.dumps({"error": "Failed to create processing report row"})
            
        report_id = resp.data[0]["id"]
        
        # Trigger background generation via internal fast endpoint
        try:
            requests.post(
                "http://localhost:8000/generate-report",
                json={"section_id": section_id, "report_id": report_id},
                timeout=2 # Fire and forget!
            )
        except requests.exceptions.ReadTimeout:
            pass # Expected timeout since the generation takes ~15-20s, but we get the 202 quickly anyway.
        except Exception as e:
            print("Failed to background ping generation:", e)
            
        return json.dumps({
            "success": True, 
            "message": "Intel Report generation initiated. Tell the user it will be available in the Reports tab in about 20-30 seconds."
        })
