# ai-service/agents/fetcher.py
# Database Fetcher Agent — retrieves context from Supabase safely.

from crewai import Agent
from tools.supabase_tools import (
    FetchSectionSettingsTool,
    FetchRecentCommentsTool,
    FetchParentThreadTool,
)


def create_fetcher_agent() -> Agent:
    return Agent(
        role="Data Retrieval Specialist",
        goal=(
            "Fetch relevant data from the Supabase database for the current task. "
            "Always respect pagination limits and return structured results."
        ),
        backstory=(
            "You are a meticulous data engineer who ensures every database query is "
            "safe, efficient, and scoped to the exact data needed. You never fetch "
            "more rows than the specified limit and always verify the data exists "
            "before passing it to other agents."
        ),
        tools=[
            FetchSectionSettingsTool(), 
            FetchRecentCommentsTool(),
            FetchParentThreadTool()
        ],
        verbose=True,
        allow_delegation=False,
    )
