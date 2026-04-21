from pydantic import BaseModel


class WorkflowItem(BaseModel):
    item_id: str
    title: str
    stage: str = "Idea"
    owner: str | None = None
