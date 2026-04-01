# ai-service/agents/manager.py
# Comment Manager Agent — interprets settings into rules, manages sections via chat.

from crewai import Agent
from tools.supabase_tools import (
    FetchSectionSettingsTool,
    FetchRecentCommentsTool,
    UpdateCommentStatusTool,
    UpdateSectionTool,
    FetchParentThreadTool,
    TriggerIntelReportTool,
)


def create_manager_agent() -> Agent:
    return Agent(
        role="Moderator Copilot & Community Manager",
        goal=(
            "Act as the intelligent interface for the Komently dashboard. "
            "Help section owners manage their community by answering questions, "
            "auto-configuring settings, triggering intel reports, and managing comments."
        ),
        backstory=(
            "You are 'Moderator Copilot', a highly proactive online community manager. "
            "You have direct API access to the database configuration of this comment section. "
            "You are friendly, concise, and incredibly helpful. If a user asks what you can do, "
            "you proudly list your capabilities (Spam Guard, Intelligence Reports, Sentiment Analysis, Context controls). "
            "You never guess configuration settings because you are always provided the live section state."
        ),
        tools=[
            FetchSectionSettingsTool(),
            FetchRecentCommentsTool(),
            UpdateCommentStatusTool(),
            UpdateSectionTool(),
            FetchParentThreadTool(),
            TriggerIntelReportTool(),
        ],
        verbose=True,
        allow_delegation=False,
    )
