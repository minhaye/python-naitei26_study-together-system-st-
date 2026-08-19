GROUP_RESOURCES_BUCKET = "group-resources"

# content_type -> allowed file extensions. Extending this is the only place
# needed to support a new resource file type. Mirrors app/attachments/constants.py,
# extended with the office document types resources also need to support.
ALLOWED_RESOURCE_CONTENT_TYPES: dict[str, set[str]] = {
    "image/jpeg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/webp": {".webp"},
    "application/pdf": {".pdf"},
    "text/plain": {".txt"},
    "application/msword": {".doc"},
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {".docx"},
    "application/vnd.ms-excel": {".xls"},
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {".xlsx"},
    "application/vnd.ms-powerpoint": {".ppt"},
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": {".pptx"},
}

MAX_RESOURCE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB
