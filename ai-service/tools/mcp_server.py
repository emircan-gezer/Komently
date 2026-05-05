"""
MCP server exposing all Komently tools over SSE transport.
Run standalone:  python -m tools.mcp_server
Default port:    8001  (override with MCP_SERVER_PORT env var)
"""

import json
import os
import requests
from datetime import datetime, timedelta

from mcp.server.fastmcp import FastMCP
from supabase import create_client, Client

mcp = FastMCP("komently-tools")


def _get_client() -> Client:
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )


# ── Supabase tools ────────────────────────────────────────────────────────────

@mcp.tool()
def fetch_section_settings(section_id: str) -> str:
    """Fetch the settings (max_chars, blacklist, ai_moderation_enabled,
    ai_toxicity_threshold) for a given comment section."""
    sb = _get_client()
    resp = (
        sb.table("comment_sections")
        .select("settings, name, status, public_id")
        .eq("id", section_id)
        .single()
        .execute()
    )
    if resp.data:
        return json.dumps(resp.data, default=str)
    return json.dumps({"error": "Section not found"})


@mcp.tool()
def fetch_recent_comments(section_id: str, limit: int = 20) -> str:
    """Fetch recent comments for a section. Returns comment body,
    moderation_status, toxicity_score, is_spam, and created_at."""
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


@mcp.tool()
def update_comment_status(comment_id: str, status: str) -> str:
    """Update the moderation_status of a specific comment to 'approved' or 'flagged'."""
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


@mcp.tool()
def update_section(
    section_id: str,
    status: str = None,
    settings_json: str = None,
) -> str:
    """Update section status ('active' or 'paused') and/or merge new settings
    via a JSON string. Supported settings keys: max_chars, blacklist,
    ai_moderation_enabled, ai_toxicity_threshold, spam_guard_enabled,
    context_analyzer_enabled, sentiment_analysis_enabled, auto_action_strikes."""
    sb = _get_client()
    current = (
        sb.table("comment_sections")
        .select("settings, status")
        .eq("id", section_id)
        .single()
        .execute()
    )
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


@mcp.tool()
def fetch_parent_thread(comment_id: str) -> str:
    """Fetch a specific parent comment by its UUID to understand the context of a reply."""
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


@mcp.tool()
def trigger_intel_report(section_id: str) -> str:
    """Trigger the Senior Data Analyst agent to generate a fresh 7-day Intel Report
    and Markdown Executive Summary for the specified section. Use this if the user
    asks for a report, metrics, or analysis."""
    sb = _get_client()

    active = (
        sb.table("section_reports")
        .select("id")
        .eq("section_id", section_id)
        .eq("status", "processing")
        .execute()
    )
    if active.data and len(active.data) > 0:
        return json.dumps({
            "error": "A report is already currently processing. Please tell the user to wait for it to finish."
        })

    resp = (
        sb.table("section_reports")
        .insert({"section_id": section_id, "status": "processing"})
        .execute()
    )
    if not resp.data:
        return json.dumps({"error": "Failed to create processing report row"})

    report_id = resp.data[0]["id"]
    try:
        requests.post(
            "http://localhost:8000/generate-report",
            json={"section_id": section_id, "report_id": report_id},
            timeout=2,
        )
    except requests.exceptions.ReadTimeout:
        pass
    except Exception as e:
        print("Failed to background ping generation:", e)

    return json.dumps({
        "success": True,
        "message": "Intel Report generation initiated. Tell the user it will be available in the Reports tab in about 20-30 seconds.",
    })


# ── Analyst tools ─────────────────────────────────────────────────────────────

@mcp.tool()
def fetch_weekly_analytics(section_id: str) -> str:
    """Fetch daily comment volume and moderation status counts for the last 7 days."""
    sb = _get_client()
    seven_days_ago = (datetime.now() - timedelta(days=7)).date().isoformat()
    resp = (
        sb.table("section_analytics_daily")
        .select("*")
        .eq("section_id", section_id)
        .gte("date", seven_days_ago)
        .order("date", desc=True)
        .execute()
    )
    return json.dumps(resp.data or [], default=str)


@mcp.tool()
def fetch_top_comments(section_id: str) -> str:
    """Fetch the top most discussed or interacted comments from the past week."""
    sb = _get_client()
    seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()
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


@mcp.tool()
def update_report_status(report_id: str, content: str) -> str:
    """Push the final compiled Markdown report to the database,
    setting its status to completed."""
    sb = _get_client()
    resp = (
        sb.table("section_reports")
        .update({
            "status": "completed",
            "report_content": content,
            "completed_at": datetime.now().isoformat(),
        })
        .eq("id", report_id)
        .execute()
    )
    if resp.data:
        return json.dumps({"success": True})
    return json.dumps({"error": "Failed to save report"})


if __name__ == "__main__":
    port = int(os.environ.get("MCP_SERVER_PORT", 8001))
    mcp.run(transport="sse", host="0.0.0.0", port=port)
