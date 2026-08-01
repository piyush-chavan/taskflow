from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("name must not be blank")
        return trimmed


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    description: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("name must not be blank")
        return trimmed


class ProjectOut(ProjectBase):
    id: int
    owner_id: int

    model_config = ConfigDict(from_attributes=True)


class StatusCount(BaseModel):
    status: str
    count: int


class ProjectStats(BaseModel):
    project_id: int
    project_name: str
    total_tasks: int
    by_status: List[StatusCount]
