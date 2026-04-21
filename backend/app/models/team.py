from pydantic import BaseModel


class Task(BaseModel):
    task_id: str
    title: str
    owner: str | None = None
    status: str = "todo"
