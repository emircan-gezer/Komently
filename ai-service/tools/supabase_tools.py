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


# ── Update Section Settings ───────────────────────────────────────────────────

class UpdateSectionSettingsInput(BaseModel):
    section_id: str = Field(description="UUID of the comment section")
    settings_json: str = Field(
        description="JSON string of settings to merge, e.g. "
        '\'{"ai_toxicity_threshold": 0.5, "max_chars": 3000}\''
    )

class UpdateSectionSettingsTool(BaseTool):
    name: str = "update_section_settings"
    description: str = (
        "Update section settings by merging the provided JSON into the existing settings. "
        "Supported keys: max_chars, blacklist, ai_moderation_enabled, ai_toxicity_threshold."
    )
    args_schema: Type[BaseModel] = UpdateSectionSettingsInput

    def _run(self, section_id: str, settings_json: str) -> str:
        try:
            new_settings = json.loads(settings_json)
        except json.JSONDecodeError:
            return json.dumps({"error": "Invalid JSON in settings_json"})

        sb = _get_client()
        # Fetch current settings
        current = sb.table("comment_sections").select("settings").eq("id", section_id).single().execute()
        if not current.data:
            return json.dumps({"error": "Section not found"})

        merged = {**(current.data.get("settings") or {}), **new_settings}
        resp = (
            sb.table("comment_sections")
            .update({"settings": merged})
            .eq("id", section_id)
            .execute()
        )
        if resp.data:
            return json.dumps({"success": True, "settings": merged})
        return json.dumps({"error": "Failed to update settings"})
