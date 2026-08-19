import uuid
from datetime import datetime
from pathlib import PurePosixPath

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.attachments.utils import sanitize_filename
from app.profiles.dto.profile_dto import UserSummary
from app.resources.constants import ALLOWED_RESOURCE_CONTENT_TYPES, MAX_RESOURCE_SIZE_BYTES


class ResourceFolderCreate(BaseModel):
    group_id: uuid.UUID
    parent_folder_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=100)


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
    """No `uploader_id`: the backend always derives the uploader from the authenticated
    caller (see resource_router.create_file), same convention as MessageCreate/sender_id."""

    group_id: uuid.UUID
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
    # Canonical identity source for the uploader -- see MessageResponse.sender. Never derive
    # a display label from uploader_id alone.
    uploader: UserSummary


class ResourceUploadUrlRequest(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    content_type: str
    file_size: int = Field(gt=0)

    @model_validator(mode="after")
    def validate_metadata(self) -> "ResourceUploadUrlRequest":
        if self.content_type not in ALLOWED_RESOURCE_CONTENT_TYPES:
            raise ValueError(f"Unsupported content type: {self.content_type}")
        if self.file_size > MAX_RESOURCE_SIZE_BYTES:
            raise ValueError(f"File exceeds maximum size of {MAX_RESOURCE_SIZE_BYTES} bytes")

        safe_name = sanitize_filename(self.file_name)
        extension = PurePosixPath(safe_name).suffix.lower()
        if extension not in ALLOWED_RESOURCE_CONTENT_TYPES[self.content_type]:
            raise ValueError(f"File extension does not match content type {self.content_type}")

        self.file_name = safe_name
        return self


class ResourceUploadUrlResponse(BaseModel):
    path: str
    upload_url: str
    token: str


class ResourceDownloadUrlResponse(BaseModel):
    url: str
    expires_in: int
