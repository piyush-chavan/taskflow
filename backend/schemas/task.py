from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

PriorityType = Literal["low", "medium", "high"]
StatusType = Literal["pending", "in_progress", "completed"]


class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    status: StatusType = "pending"
    priority: PriorityType = Field(
        default="medium", description="Task priority: low, medium, or high"
    )
    due_date: Optional[str] = Field(default=None, max_length=100)
    project_id: int

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("title must not be blank")
        return trimmed


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[StatusType] = None
    priority: Optional[PriorityType] = None
    due_date: Optional[str] = Field(default=None, max_length=100)
    project_id: Optional[int] = None

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("title must not be blank")
        return trimmed


class TaskOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    due_date: Optional[str] = None
    project_id: int

    model_config = ConfigDict(from_attributes=True)
