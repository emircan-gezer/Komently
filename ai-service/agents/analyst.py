# ai-service/agents/analyst.py
# Data Analyst Agent — synthesizes SQL analytics and raw comments into a readable Markdown report.

from crewai import Agent
from tools.analyst_tools import (
    FetchWeeklyAnalyticsTool,
    FetchTopCommentsTool,
    UpdateReportStatusTool
)

def create_analyst_agent() -> Agent:
    return Agent(
        role="Senior Data Analyst",
        goal=(
            "Retrieve the last 7 days of comment volume, identify key discussion trends "
            "from the raw comments, and compile a beautiful, readable Markdown report "
            "for the section owner. Finally, save the report back to the database."
        ),
        backstory=(
            "You are a highly analytical data scientist specializing in community health. "
            "You excel at turning dry SQL aggregation results and scattered comment logs into "
            "Executive Summaries that quickly highlight spam spikes, community sentiment, "
            "and trending conversation topics. You write in clear, engaging Markdown."
        ),
        tools=[
            FetchWeeklyAnalyticsTool(),
            FetchTopCommentsTool(),
            UpdateReportStatusTool()
        ],
        verbose=True,
        allow_delegation=False,
    )
