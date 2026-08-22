import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class RoadmapPhaseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)

    @field_validator('name')
    @classmethod
    def strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError('Phase name must not be blank')
        return value


class RoadmapCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    goal: str = Field(min_length=1, max_length=500)
    due_date: date | None = None
    phases: list[RoadmapPhaseCreate] = Field(default_factory=list, max_length=20)

    @field_validator('title', 'goal')
    @classmethod
    def strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError('Value must not be blank')
        return value


class RoadmapUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    goal: str | None = Field(default=None, min_length=1, max_length=500)
    due_date: date | None = None

    @field_validator('title', 'goal')
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        return RoadmapCreate.strip_text(value) if value is not None else value

    @model_validator(mode='after')
    def has_change(self):
        if not self.model_fields_set:
            raise ValueError('Provide at least one roadmap field')
        return self


class RoadmapPhaseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    progress: int | None = Field(default=None, ge=0, le=100)

    @field_validator('name')
    @classmethod
    def strip_name(cls, value: str | None) -> str | None:
        if value is not None:
            value = value.strip()
            if not value:
                raise ValueError('Phase name must not be blank')
        return value

    @model_validator(mode='after')
    def has_change(self):
        if not self.model_fields_set:
            raise ValueError('Provide at least one phase field')
        return self


class RoadmapPhaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    position: int
    progress: int


class RoadmapResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    goal: str
    due_date: date | None
    created_at: datetime
    phases: list[RoadmapPhaseResponse]


class RoadmapSuggestRequest(BaseModel):
    description: str = Field(min_length=1, max_length=500)

    @field_validator('description')
    @classmethod
    def strip_description(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError('Description must not be blank')
        return value


class RoadmapPhaseSuggestion(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class RoadmapSuggestion(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    goal: str = Field(min_length=1, max_length=500)
    phases: list[RoadmapPhaseSuggestion] = Field(min_length=1, max_length=20)
