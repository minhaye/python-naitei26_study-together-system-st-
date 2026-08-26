import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser
from app.core.permissions import is_active_group_member, is_group_manager
from app.db.session import get_db_session
from app.notes.dto.note_dto import NoteCreate, NoteResponse, NoteUpdate
from app.notes.services.note_service import NotesService

router = APIRouter(prefix="/notes", tags=["Notes"])
service = NotesService()


async def _require_group_member(session: AsyncSession, group_id: uuid.UUID, user_id: uuid.UUID) -> None:
    if not await is_active_group_member(session, group_id, user_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not a member of this group")


async def _require_note_manager(session: AsyncSession, group_id: uuid.UUID, user_id: uuid.UUID) -> None:
    """Notes are shared Group content, not personal notes: mutation authority is the Group
    Owner/Moderator role, never note authorship (`author_id` is stored only to show who
    originally wrote it -- see NoteResponse.author). Active Group membership is checked first
    -- a manager whose Group membership has since lapsed (left/removed/banned) must not retain
    mutation power via a stale membership row."""
    await _require_group_member(session, group_id, user_id)
    if not await is_group_manager(session, group_id, user_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the group owner or a moderator can manage notes")


@router.post("", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    data: NoteCreate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Create a note within a group. Only the group owner or a moderator can create notes."""
    await _require_note_manager(session, data.group_id, current_user.id)
    try:
        note = await service.create(session, data, author_id=current_user.id)
        await session.commit()
        return note
    except Exception as e:
        await session.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Could not create note: {str(e)}")


@router.get("", response_model=list[NoteResponse])
async def list_notes(
    group_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """List notes for a group. Requires active membership in the group."""
    await _require_group_member(session, group_id, current_user.id)
    return await service.list_by_group(session, group_id)


@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(
    note_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Single-note lookup, primarily for Realtime hydration on the frontend (a raw
    `group_notes` postgres_changes row has `author_id` but not the joined `author:
    UserSummary` -- same reason useChannelMessagesRealtime.ts hydrates messages via
    GET /messages/{id}). Read access mirrors list_notes: any active Group member."""
    note = await service.get_by_id(session, note_id)
    if not note:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found")
    await _require_group_member(session, note.group_id, current_user.id)
    return note


@router.put("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: uuid.UUID,
    data: NoteUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Update a note. Only the group owner or a moderator of the note's group can update it."""
    note = await service.get_by_id(session, note_id)
    if not note:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found")
    await _require_note_manager(session, note.group_id, current_user.id)
    try:
        updated = await service.update(session, note, data)
        await session.commit()
        return updated
    except Exception as e:
        await session.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Could not update note: {str(e)}")


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Delete a note. Only the group owner or a moderator of the note's group can delete it."""
    note = await service.get_by_id(session, note_id)
    if not note:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found")
    await _require_note_manager(session, note.group_id, current_user.id)
    try:
        await service.delete(session, note)
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Could not delete note: {str(e)}")
