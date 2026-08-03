from typing import Literal, Optional

from pydantic import BaseModel


class QuickAddRequest(BaseModel):
    description: str
    project_id: int


class ParsedTask(BaseModel):
    title: str
    priority: Literal["low", "medium", "high"]
    due_date_hint: Optional[str] = None
