# ai-service/crew.py
from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task

from tools.supabase_tools import (
    FetchSectionSettingsTool,
    FetchRecentCommentsTool,
    FetchParentThreadTool,
    UpdateCommentStatusTool,
    UpdateSectionTool,
    TriggerIntelReportTool,
)
from tools.analyst_tools import (
    FetchWeeklyAnalyticsTool,
    FetchTopCommentsTool,
    UpdateReportStatusTool,
)

@CrewBase
class ModerationCrew:
    """ModerationCrew class"""

    agents_config = 'config/agents.yaml'
    tasks_config = 'config/tasks.yaml'

    @agent
    def fetcher(self) -> Agent:
        return Agent(
            config=self.agents_config['fetcher'],
            tools=[
                FetchSectionSettingsTool(),
                FetchRecentCommentsTool(),
                FetchParentThreadTool()
            ],
            verbose=True,
            allow_delegation=False
        )

    @agent
    def manager(self) -> Agent:
        return Agent(
            config=self.agents_config['manager'],
            tools=[
                FetchSectionSettingsTool(),
                FetchRecentCommentsTool(),
                UpdateCommentStatusTool(),
                UpdateSectionTool(),
                FetchParentThreadTool(),
                TriggerIntelReportTool(),
            ],
            verbose=True,
            allow_delegation=False
        )

    @agent
    def moderator(self) -> Agent:
        return Agent(
            config=self.agents_config['moderator'],
            tools=[],
            verbose=True,
            allow_delegation=False
        )

    @task
    def fetch_task(self) -> Task:
        return Task(
            config=self.tasks_config['fetch_task']
        )

    @task
    def manage_task(self) -> Task:
        return Task(
            config=self.tasks_config['manage_task']
        )

    @task
    def moderate_task(self) -> Task:
        return Task(
            config=self.tasks_config['moderate_task']
        )

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=[self.fetcher(), self.manager(), self.moderator()],
            tasks=[self.fetch_task(), self.manage_task(), self.moderate_task()],
            process=Process.sequential,
            verbose=True
        )


@CrewBase
class ChatCrew:
    """ChatCrew class"""

    agents_config = 'config/agents.yaml'
    tasks_config = 'config/tasks.yaml'

    @agent
    def manager(self) -> Agent:
        return Agent(
            config=self.agents_config['manager'],
            tools=[
                FetchSectionSettingsTool(),
                FetchRecentCommentsTool(),
                UpdateCommentStatusTool(),
                UpdateSectionTool(),
                FetchParentThreadTool(),
                TriggerIntelReportTool(),
            ],
            verbose=True,
            allow_delegation=False
        )

    @task
    def chat_task(self) -> Task:
        return Task(
            config=self.tasks_config['chat_task']
        )

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=[self.manager()],
            tasks=[self.chat_task()],
            process=Process.sequential,
            verbose=True
        )


@CrewBase
class AnalystCrew:
    """AnalystCrew class"""

    agents_config = 'config/agents.yaml'
    tasks_config = 'config/tasks.yaml'

    @agent
    def analyst(self) -> Agent:
        return Agent(
            config=self.agents_config['analyst'],
            tools=[
                FetchWeeklyAnalyticsTool(),
                FetchTopCommentsTool(),
                UpdateReportStatusTool()
            ],
            verbose=True,
            allow_delegation=False
        )

    @task
    def report_task(self) -> Task:
        return Task(
            config=self.tasks_config['report_task']
        )

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=[self.analyst()],
            tasks=[self.report_task()],
            process=Process.sequential,
            verbose=True
        )
