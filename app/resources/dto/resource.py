import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ResourceFolderCreate(BaseModel):
    group_id: uuid.UUID
    parent_folder_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=100)
    created_by: uuid.UUID


class ResourceFolderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    parent_folder_id: uuid.UUID | None = None


class ResourceFolderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    group_id: uuid.UUID
    parent_folder_id: uuid.UUID | None
    name: str
    created_by: uuid.UUID
    created_at: datetime


class ResourceCreate(BaseModel):
    group_id: uuid.UUID
    uploader_id: uuid.UUID
    folder_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=255)
    file_path: str
    file_type: str | None = None
    file_size: int | None = Field(default=None, ge=0)


class ResourceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    folder_id: uuid.UUID | None = None


class ResourceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    group_id: uuid.UUID
    uploader_id: uuid.UUID
    folder_id: uuid.UUID | None
    name: str
    file_path: str
    file_type: str | None
    file_size: int | None
    created_at: datetime
    updated_at: datetime
