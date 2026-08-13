import re
from pathlib import PurePosixPath

_UNSAFE_CHARS_RE = re.compile(r"[^A-Za-z0-9._-]+")


def sanitize_filename(file_name: str) -> str:
    """Strips any directory components and restricts the name to a safe charset.

    Defeats path traversal (`../`, `..\\`, absolute paths) regardless of what
    the client sends, since only the basename survives.
    """
    normalized = file_name.replace("\\", "/")
    name = PurePosixPath(normalized).name
    name = _UNSAFE_CHARS_RE.sub("_", name).strip("._")
    return (name or "file")[:150]
