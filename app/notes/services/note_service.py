import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.notes.entities.note_entity import Note
from app.notes.dto.note_dto import NoteCreate, NoteUpdate


class NotesService:
    async def create(self, session: AsyncSession, data: NoteCreate, author_id: uuid.UUID) -> Note:
        note = Note(**data.model_dump(), author_id=author_id)
        session.add(note)
        await session.flush()
        await session.refresh(note, attribute_names=["author"])
        return note

    async def get_by_id(self, session: AsyncSession, note_id: uuid.UUID) -> Note | None:
        return await session.get(Note, note_id, options=[selectinload(Note.author)])

    async def list_by_group(self, session: AsyncSession, group_id: uuid.UUID) -> list[Note]:
        """Chronological (created_at ascending) -- the paper-stack UI navigates notes as a
        stable, deterministic sequence, not a feed sorted newest-first."""
        result = await session.execute(
            select(Note)
            .options(selectinload(Note.author))
            .where(Note.group_id == group_id)
            .order_by(Note.created_at.asc())
        )
        return list(result.scalars().all())

    async def update(self, session: AsyncSession, note: Note, data: NoteUpdate) -> Note:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(note, field, value)
        await session.flush()
        return note

    async def delete(self, session: AsyncSession, note: Note) -> None:
        await session.delete(note)
        await session.flush()
