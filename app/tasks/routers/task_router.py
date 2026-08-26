import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth.dependencies import get_current_user
from app.auth.dto.auth_dto import CurrentUser
from app.db.session import get_db_session
from app.tasks.dto.task_dto import TaskBulkCreate, TaskCreate, TaskResponse, TaskUpdate
from app.tasks.entities.task_entity import Task

router = APIRouter(prefix='/tasks', tags=['Tasks'])


@router.get('', response_model=list[TaskResponse])
async def list_tasks(from_date: date, to_date: date, current_user: CurrentUser = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)):
    """List the authenticated user's tasks whose due date falls within the given date range."""
    result = await session.execute(
        select(Task).where(Task.user_id == current_user.id, Task.due_date.between(from_date, to_date)).order_by(Task.due_date, Task.created_at)
    )
    return list(result.scalars())


@router.post('', response_model=TaskResponse, status_code=201)
async def create_task(data: TaskCreate, current_user: CurrentUser = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)):
    """Create a new task owned by the authenticated user."""
    task = Task(**data.model_dump(), user_id=current_user.id)
    session.add(task)
    await session.commit()
    await session.refresh(task)
    return task


@router.post('/bulk', response_model=list[TaskResponse], status_code=201)
async def create_tasks(data: TaskBulkCreate, current_user: CurrentUser = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)):
    """Create multiple tasks at once, all owned by the authenticated user."""
    tasks = [Task(**item.model_dump(), user_id=current_user.id) for item in data.tasks]
    session.add_all(tasks)
    await session.commit()
    for task in tasks:
        await session.refresh(task)
    return tasks


@router.patch('/{task_id}', response_model=TaskResponse)
async def update_task(task_id: uuid.UUID, data: TaskUpdate, current_user: CurrentUser = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)):
    """Partially update a task. Users may only update their own tasks."""
    task = await session.scalar(select(Task).where(Task.id == task_id, Task.user_id == current_user.id))
    if not task:
        raise HTTPException(404, 'Task not found')
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    await session.commit()
    await session.refresh(task)
    return task


@router.patch('/{task_id}/complete', response_model=TaskResponse)
async def toggle_task(task_id: uuid.UUID, current_user: CurrentUser = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)):
    """Toggle a task's completion status: marks it completed if incomplete, or reopens it if already completed. Users may only toggle their own tasks."""
    from datetime import datetime, timezone
    task = await session.scalar(select(Task).where(Task.id == task_id, Task.user_id == current_user.id))
    if not task:
        raise HTTPException(404, 'Task not found')
    task.completed_at = None if task.completed_at else datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(task)
    return task


@router.delete('/{task_id}', status_code=204)
async def delete_task(task_id: uuid.UUID, current_user: CurrentUser = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)):
    """Delete a task. Users may only delete their own tasks."""
    task = await session.scalar(select(Task).where(Task.id == task_id, Task.user_id == current_user.id))
    if not task:
        raise HTTPException(404, 'Task not found')
    await session.delete(task)
    await session.commit()
