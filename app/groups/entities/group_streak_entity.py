import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, Integer, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.groups.entities.group_entity import Group


class GroupStreak(Base):
    __tablename__ = "group_streaks"

    group_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True)
    current_streak: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    highest_streak: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    last_streak_date: Mapped[date | None] = mapped_column(Date)
    activity_date: Mapped[date] = mapped_column(Date, server_default=text("CURRENT_DATE"))
    today_messages_count: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    today_study_minutes: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))

    group: Mapped["Group"] = relationship(back_populates="streak")
