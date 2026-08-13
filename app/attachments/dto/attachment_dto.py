from pathlib import PurePosixPath

from pydantic import BaseModel, Field, model_validator

from app.attachments.constants import ALLOWED_ATTACHMENT_CONTENT_TYPES, MAX_ATTACHMENT_SIZE_BYTES
from app.attachments.utils import sanitize_filename


class UploadUrlRequest(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    content_type: str
    file_size: int = Field(gt=0)

    @model_validator(mode="after")
    def validate_metadata(self) -> "UploadUrlRequest":
        if self.content_type not in ALLOWED_ATTACHMENT_CONTENT_TYPES:
            raise ValueError(f"Unsupported content type: {self.content_type}")
        if self.file_size > MAX_ATTACHMENT_SIZE_BYTES:
            raise ValueError(f"File exceeds maximum size of {MAX_ATTACHMENT_SIZE_BYTES} bytes")

        safe_name = sanitize_filename(self.file_name)
        extension = PurePosixPath(safe_name).suffix.lower()
        if extension not in ALLOWED_ATTACHMENT_CONTENT_TYPES[self.content_type]:
            raise ValueError(f"File extension does not match content type {self.content_type}")

        self.file_name = safe_name
        return self


class UploadUrlResponse(BaseModel):
    path: str
    upload_url: str
    token: str


class DownloadUrlResponse(BaseModel):
    url: str
    expires_in: int
