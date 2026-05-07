# ai-service/crew.py

from crewai import Agent, Crew, LLM, Process, Task
from crewai.project import CrewBase, agent, crew, task

from tools.mcp_adapter import (
    FetchSectionSettingsTool,
    FetchRecentCommentsTool,
    FetchParentThreadTool,
    UpdateCommentStatusTool,
    UpdateSectionTool,
    TriggerIntelReportTool,
    FetchWeeklyAnalyticsTool,
    FetchTopCommentsTool,
    UpdateReportStatusTool,
)

_manager_llm = LLM(model="gpt-4o-mini", temperature=0)


# ── Moderation Crew — hierarchical, 3 parallel specialists ───────────────────

@CrewBase
class ModerationCrew:
    """
    Hierarchical crew: three specialist agents evaluate the comment independently;
    the manager LLM arbitrates their findings into a single JSON verdict.
    No sequential waterfall — each agent focuses on its own domain.
    """

    agents_config = 'config/agents.yaml'
    tasks_config  = 'config/tasks.yaml'

    @agent
    def spam_agent(self) -> Agent:
        return Agent(
            config=self.agents_config['spam_agent'],
            tools=[FetchSectionSettingsTool, FetchRecentCommentsTool],
            verbose=True,
        )

    @agent
    def toxicity_agent(self) -> Agent:
        return Agent(
            config=self.agents_config['toxicity_agent'],
            tools=[FetchSectionSettingsTool],
            verbose=True,
        )

    @agent
    def context_agent(self) -> Agent:
        return Agent(
            config=self.agents_config['context_agent'],
            tools=[FetchSectionSettingsTool, FetchParentThreadTool],
            verbose=True,
        )

    @task
    def moderation_task(self) -> Task:
        return Task(config=self.tasks_config['moderation_task'])

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=[self.spam_agent(), self.toxicity_agent(), self.context_agent()],
            tasks=[self.moderation_task()],
            process=Process.hierarchical,
            manager_llm=_manager_llm,
            verbose=True,
        )


# ── Chat Crew — single manager agent, called directly from main.py ────────────

@CrewBase
class ChatCrew:
    """
    Single-agent crew for dashboard chat. No graph overhead — main.py calls
    crew().kickoff() directly. The manager agent has full tool access.
    """

    agents_config = 'config/agents.yaml'
    tasks_config  = 'config/tasks.yaml'

    @agent
    def manager(self) -> Agent:
        return Agent(
            config=self.agents_config['manager'],
            tools=[
                FetchSectionSettingsTool,
                FetchRecentCommentsTool,
                UpdateCommentStatusTool,
                UpdateSectionTool,
                FetchParentThreadTool,
                TriggerIntelReportTool,
            ],
            verbose=True,
            allow_delegation=False,
        )

    @task
    def chat_task(self) -> Task:
        return Task(config=self.tasks_config['chat_task'], agent=self.manager())

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=[self.manager()],
            tasks=[self.chat_task()],
            process=Process.sequential,
            verbose=True,
        )


# ── Analyst Crew — single analyst agent, called directly from main.py ─────────

@CrewBase
class AnalystCrew:
    """
    Single-agent crew for report generation. Runs as a background task in main.py.
    No graph overhead needed for a single, linear analysis job.
    """

    agents_config = 'config/agents.yaml'
    tasks_config  = 'config/tasks.yaml'

    @agent
    def analyst(self) -> Agent:
        return Agent(
            config=self.agents_config['analyst'],
            tools=[
                FetchWeeklyAnalyticsTool,
                FetchTopCommentsTool,
                UpdateReportStatusTool,
            ],
            verbose=True,
            allow_delegation=False,
        )

    @task
    def report_task(self) -> Task:
        return Task(config=self.tasks_config['report_task'], agent=self.analyst())

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=[self.analyst()],
            tasks=[self.report_task()],
            process=Process.sequential,
            verbose=True,
        )
