import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser
from app.db.session import get_db_session
from app.roadmaps.dto.roadmap_dto import RoadmapCreate, RoadmapPhaseResponse, RoadmapPhaseUpdate, RoadmapResponse, RoadmapUpdate
from app.roadmaps.entities.roadmap_entity import Roadmap, RoadmapPhase

router = APIRouter(prefix='/roadmaps', tags=['Roadmaps'])


@router.get('', response_model=list[RoadmapResponse])
async def list_roadmaps(current_user: CurrentUser = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)):
    result = await session.execute(
        select(Roadmap).where(Roadmap.user_id == current_user.id).options(selectinload(Roadmap.phases)).order_by(Roadmap.created_at.desc())
    )
    return list(result.scalars())


@router.post('', response_model=RoadmapResponse, status_code=201)
async def create_roadmap(data: RoadmapCreate, current_user: CurrentUser = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)):
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
    roadmap = await session.scalar(select(Roadmap).where(Roadmap.id == roadmap_id, Roadmap.user_id == current_user.id).options(selectinload(Roadmap.phases)))
    if not roadmap:
        raise HTTPException(404, 'Roadmap not found')
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(roadmap, field, value)
    await session.commit()
    return roadmap


@router.patch('/{roadmap_id}/phases/{phase_id}', response_model=RoadmapPhaseResponse)
async def update_phase(roadmap_id: uuid.UUID, phase_id: uuid.UUID, data: RoadmapPhaseUpdate, current_user: CurrentUser = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)):
    phase = await session.scalar(
        select(RoadmapPhase).join(Roadmap).where(RoadmapPhase.id == phase_id, RoadmapPhase.roadmap_id == roadmap_id, Roadmap.user_id == current_user.id)
    )
    if not phase:
        raise HTTPException(404, 'Roadmap phase not found')
    phase.progress = data.progress
    await session.commit()
    await session.refresh(phase)
    return phase
