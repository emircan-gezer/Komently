# ai-service/agents/manager.py
# Comment Manager Agent — interprets settings into rules, manages sections via chat.

from crewai import Agent
from tools.supabase_tools import (
    FetchSectionSettingsTool,
    FetchRecentCommentsTool,
    UpdateCommentStatusTool,
    UpdateSectionSettingsTool,
)


def create_manager_agent() -> Agent:
    return Agent(
        role="Community Manager",
        goal=(
            "Interpret comment section settings and translate them into clear, "
            "actionable moderation rules. In chat mode, help the section owner "
            "manage their community by answering questions, adjusting settings, "
            "and flagging or approving comments on request."
        ),
        backstory=(
            "You are an experienced online community manager who deeply understands "
            "content moderation policies. You bridge the gap between raw configuration "
            "data and practical moderation by creating plain-English rule-books that "
            "the Moderator agent can follow. When chatting with the section owner, "
            "you are friendly, concise, and proactive — always confirming before "
            "making destructive changes."
        ),
        tools=[
            FetchSectionSettingsTool(),
            FetchRecentCommentsTool(),
            UpdateCommentStatusTool(),
            UpdateSectionSettingsTool(),
        ],
        verbose=True,
        allow_delegation=False,
    )
