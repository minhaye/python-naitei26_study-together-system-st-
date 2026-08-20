import uuid
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    due_date: date
    priority: int = Field(ge=1, le=3)

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Task title must not be blank")
        return value


class TaskBulkCreate(BaseModel):
    tasks: list[TaskCreate] = Field(min_length=1, max_length=50)


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    due_date: date | None = None
    priority: int | None = Field(default=None, ge=1, le=3)

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str | None) -> str | None:
        return TaskCreate.strip_title(value) if value is not None else value

    @model_validator(mode="after")
    def has_change(self):
        if not self.model_fields_set:
            raise ValueError("Provide at least one task field")
        return self

class TaskResponse(TaskCreate):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    completed_at: datetime | None
    created_at: datetime
