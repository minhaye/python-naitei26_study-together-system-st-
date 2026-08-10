import uuid

from pydantic import BaseModel


class CurrentUser(BaseModel):
    """Identity derived from a verified Supabase access token (claim `sub` -> id)."""

    id: uuid.UUID
    email: str | None = None
    role: str | None = None
