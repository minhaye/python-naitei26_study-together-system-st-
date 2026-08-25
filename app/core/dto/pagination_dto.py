from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic `{items, total}` envelope shared by every list endpoint that backs a paged
    UI table (forum posts, moderation reports/bans/actions, moderators). `total` is the
    count of matching rows across all pages, not just the current page, so the frontend
    can render "Trang X / Y" and jump to an arbitrary page."""

    items: list[T]
    total: int
