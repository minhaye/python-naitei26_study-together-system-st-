MESSAGE_ATTACHMENTS_BUCKET = "message-attachments"

# content_type -> allowed file extensions. Extending this is the only place
# needed to support a new attachment type.
ALLOWED_ATTACHMENT_CONTENT_TYPES: dict[str, set[str]] = {
    "image/jpeg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/webp": {".webp"},
    "application/pdf": {".pdf"},
    "text/plain": {".txt"},
}

MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
