import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser
from app.db.session import get_db_session
from app.roadmaps.dto.roadmap_dto import (
    RoadmapCreate,
    RoadmapPhaseCreate,
    RoadmapPhaseResponse,
    RoadmapPhaseUpdate,
    RoadmapResponse,
    RoadmapSuggestQuestionsRequest,
    RoadmapSuggestQuestionsResponse,
    RoadmapSuggestRequest,
    RoadmapSuggestion,
    RoadmapUpdate,
    TaskSuggestRequest,
    TaskSuggestionResponse,
)
from app.roadmaps.entities.roadmap_entity import Roadmap, RoadmapPhase
from app.roadmaps.services.roadmap_ai_service import RoadmapAiError, RoadmapAiService, RoadmapAiServiceNotConfigured

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/roadmaps', tags=['Roadmaps'])
roadmap_ai_service = RoadmapAiService()


@router.get('', response_model=list[RoadmapResponse])
async def list_roadmaps(current_user: CurrentUser = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)):
    """List all roadmaps belonging to the current user, including their phases, most recently created first."""
    result = await session.execute(
        select(Roadmap).where(Roadmap.user_id == current_user.id).options(selectinload(Roadmap.phases)).order_by(Roadmap.created_at.desc())
    )
    return list(result.scalars())


@router.post('/suggest/questions', response_model=RoadmapSuggestQuestionsResponse)
async def suggest_roadmap_questions(data: RoadmapSuggestQuestionsRequest, current_user: CurrentUser = Depends(get_current_user)):
    """Use AI to generate clarifying questions for a roadmap goal description, to refine the roadmap suggestion."""
    try:
        response = await roadmap_ai_service.suggest_questions(data.description)
        if not response.questions:
            raise HTTPException(400, 'Mô tả mục tiêu của bạn quá ngắn hoặc không rõ nghĩa. Vui lòng nhập chi tiết hơn.')
        return response
    except RoadmapAiServiceNotConfigured as exc:
        logger.error("Roadmap AI questions requested but not configured: %s", exc)
        raise HTTPException(503, 'Tính năng gợi ý bằng AI hiện chưa khả dụng.') from exc
    except RoadmapAiError as exc:
        # exc carries the raw provider error (may include request payloads) -- log it for
        # debugging but never forward it to the client as the HTTP detail.
        logger.warning("Roadmap AI questions generation failed: %s", exc)
        raise HTTPException(502, 'Không thể tạo câu hỏi lúc này, vui lòng thử lại sau.') from exc


@router.post('/suggest', response_model=RoadmapSuggestion)
async def suggest_roadmap(data: RoadmapSuggestRequest, current_user: CurrentUser = Depends(get_current_user)):
    """Use AI to generate a suggested roadmap (phases) based on a goal description and answers to clarifying questions."""
    try:
        response = await roadmap_ai_service.suggest(data.description, data.answers)
        if not response.phases:
            raise HTTPException(400, 'Không thể tạo lộ trình. Mô tả mục tiêu của bạn không rõ nghĩa.')
        return response
    except RoadmapAiServiceNotConfigured as exc:
        logger.error("Roadmap AI suggestion requested but not configured: %s", exc)
        raise HTTPException(503, 'Tính năng gợi ý bằng AI hiện chưa khả dụng.') from exc
    except RoadmapAiError as exc:
        # exc carries the raw provider error (may include request payloads) -- log it for
        # debugging but never forward it to the client as the HTTP detail.
        logger.warning("Roadmap AI suggestion failed: %s", exc)
        raise HTTPException(502, 'Không thể tạo gợi ý lúc này, vui lòng thử lại sau.') from exc


@router.post('/suggest/tasks', response_model=TaskSuggestionResponse)
async def suggest_tasks(data: TaskSuggestRequest, current_user: CurrentUser = Depends(get_current_user)):
    """Use AI to generate suggested tasks for a roadmap phase based on the goal, phases, and due date."""
    try:
        response = await roadmap_ai_service.suggest_tasks(
            goal=data.goal,
            phases=data.phases,
            today=data.today,
            due_date=data.due_date,
        )
        if not response.tasks:
            raise HTTPException(400, 'Mục tiêu không rõ ràng để tạo công việc. Vui lòng mô tả chi tiết hơn.')
        return response
    except RoadmapAiServiceNotConfigured as exc:
        logger.error("Task AI suggestion requested but not configured: %s", exc)
        raise HTTPException(503, 'Tính năng gợi ý bằng AI hiện chưa khả dụng.') from exc
    except RoadmapAiError as exc:
        logger.warning("Task AI suggestion failed: %s", exc)
        raise HTTPException(502, 'Không thể tạo gợi ý công việc lúc này, vui lòng thử lại sau.') from exc


@router.post('', response_model=RoadmapResponse, status_code=201)
async def create_roadmap(data: RoadmapCreate, current_user: CurrentUser = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)):
    """Create a new roadmap for the current user with an initial set of phases."""
    roadmap = Roadmap(
        user_id=current_user.id,
        title=data.title,
        goal=data.goal,
        due_date=data.due_date,
        phases=[RoadmapPhase(name=phase.name, position=index, progress=0) for index, phase in enumerate(data.phases)],
    )
    session.add(roadmap)
    await session.commit()
    result = await session.execute(select(Roadmap).where(Roadmap.id == roadmap.id).options(selectinload(Roadmap.phases)))
    return result.scalar_one()


@router.patch('/{roadmap_id}', response_model=RoadmapResponse)
async def update_roadmap(roadmap_id: uuid.UUID, data: RoadmapUpdate, current_user: CurrentUser = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)):
    """Update a roadmap owned by the current user."""
    roadmap = await session.scalar(select(Roadmap).where(Roadmap.id == roadmap_id, Roadmap.user_id == current_user.id).options(selectinload(Roadmap.phases)))
    if not roadmap:
        raise HTTPException(404, 'Roadmap not found')
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(roadmap, field, value)
    await session.commit()
    return roadmap


@router.delete('/{roadmap_id}', status_code=204)
async def delete_roadmap(roadmap_id: uuid.UUID, current_user: CurrentUser = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)):
    """Delete a roadmap owned by the current user."""
    roadmap = await session.scalar(select(Roadmap).where(Roadmap.id == roadmap_id, Roadmap.user_id == current_user.id))
    if not roadmap:
        raise HTTPException(404, 'Roadmap not found')
    await session.delete(roadmap)
    await session.commit()


@router.post('/{roadmap_id}/phases', response_model=RoadmapPhaseResponse, status_code=201)
async def add_phase(roadmap_id: uuid.UUID, data: RoadmapPhaseCreate, current_user: CurrentUser = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)):
    """Add a new phase to a roadmap owned by the current user. A roadmap may have at most 20 phases."""
    roadmap = await session.scalar(select(Roadmap).where(Roadmap.id == roadmap_id, Roadmap.user_id == current_user.id).options(selectinload(Roadmap.phases)))
    if not roadmap:
        raise HTTPException(404, 'Roadmap not found')
    if len(roadmap.phases) >= 20:
        raise HTTPException(422, 'Roadmap already has the maximum 20 phases')
    position = max((p.position for p in roadmap.phases), default=-1) + 1
    phase = RoadmapPhase(roadmap_id=roadmap_id, name=data.name, position=position, progress=0)
    session.add(phase)
    await session.commit()
    await session.refresh(phase)
    return phase


@router.patch('/{roadmap_id}/phases/{phase_id}', response_model=RoadmapPhaseResponse)
async def update_phase(roadmap_id: uuid.UUID, phase_id: uuid.UUID, data: RoadmapPhaseUpdate, current_user: CurrentUser = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)):
    """Update a phase of a roadmap owned by the current user, e.g. its name or progress."""
    phase = await session.scalar(
        select(RoadmapPhase).join(Roadmap).where(RoadmapPhase.id == phase_id, RoadmapPhase.roadmap_id == roadmap_id, Roadmap.user_id == current_user.id)
    )
    if not phase:
        raise HTTPException(404, 'Roadmap phase not found')
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(phase, field, value)
    await session.commit()
    await session.refresh(phase)
    return phase


@router.delete('/{roadmap_id}/phases/{phase_id}', status_code=204)
async def delete_phase(roadmap_id: uuid.UUID, phase_id: uuid.UUID, current_user: CurrentUser = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)):
    """Delete a phase from a roadmap owned by the current user."""
    phase = await session.scalar(
        select(RoadmapPhase).join(Roadmap).where(RoadmapPhase.id == phase_id, RoadmapPhase.roadmap_id == roadmap_id, Roadmap.user_id == current_user.id)
    )
    if not phase:
        raise HTTPException(404, 'Roadmap phase not found')
    await session.delete(phase)
    await session.commit()
