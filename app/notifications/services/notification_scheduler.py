"""Background scheduler service for Goal/Task Notifications.

Handles:
1. TASK_DAILY_REMINDER: Morning reminder for incomplete tasks due today.
2. TASK_DUE_SOON: Alert for tasks due today that are still incomplete.
3. TASK_OVERDUE: Alert for incomplete tasks past their due date.
"""

from datetime import date, datetime, timezone
from typing import Dict, List
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import NotificationType
from app.notifications.dto.notification_dto import NotificationCreate
from app.notifications.entities.notification_entity import Notification
from app.notifications.services.notification_service import NotificationsService
from app.tasks.entities.task_entity import Task

notifications_service = NotificationsService()


class NotificationSchedulerService:

    async def check_daily_reminders(
        self, session: AsyncSession, target_date: date | None = None
    ) -> List[Notification]:
        """Check all users with incomplete tasks due on target_date (default today)
        and trigger a TASK_DAILY_REMINDER notification if one hasn't been sent today."""
        today = target_date or datetime.now(timezone.utc).date()

        # Query incomplete tasks due today, grouped by user_id
        stmt = (
            select(Task.user_id, func.count(Task.id).label("task_count"))
            .where(Task.due_date == today, Task.completed_at.is_(None))
            .group_by(Task.user_id)
        )
        result = await session.execute(stmt)
        user_tasks = result.all()

        notifications = []
        start_of_day = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc)

        for user_id, count in user_tasks:
            # Check if TASK_DAILY_REMINDER notification already sent to this user today
            check_stmt = select(Notification).where(
                Notification.user_id == user_id,
                Notification.type == NotificationType.TASK_DAILY_REMINDER,
                Notification.created_at >= start_of_day,
            )
            existing = (await session.execute(check_stmt)).scalars().first()
            if existing:
                continue

            noti = await notifications_service.create(
                session,
                NotificationCreate(
                    user_id=user_id,
                    type=NotificationType.TASK_DAILY_REMINDER,
                    data={"task_count": count},
                ),
            )
            notifications.append(noti)

        return notifications

    async def check_due_soon_tasks(
        self, session: AsyncSession, target_date: date | None = None
    ) -> List[Notification]:
        """Check incomplete tasks due today and trigger TASK_DUE_SOON alerts."""
        today = target_date or datetime.now(timezone.utc).date()
        start_of_day = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc)

        stmt = select(Task).where(Task.due_date == today, Task.completed_at.is_(None))
        result = await session.execute(stmt)
        tasks = result.scalars().all()

        notifications = []
        for task in tasks:
            # Check if TASK_DUE_SOON alert already sent for this task today
            check_stmt = select(Notification).where(
                Notification.user_id == task.user_id,
                Notification.type == NotificationType.TASK_DUE_SOON,
                Notification.created_at >= start_of_day,
            )
            existing = (await session.execute(check_stmt)).scalars().first()
            if existing:
                continue

            noti = await notifications_service.create(
                session,
                NotificationCreate(
                    user_id=task.user_id,
                    type=NotificationType.TASK_DUE_SOON,
                    data={
                        "task_title": task.title[:50],
                        "hours_left": 2,
                    },
                ),
            )
            notifications.append(noti)

        return notifications

    async def check_overdue_tasks(
        self, session: AsyncSession, target_date: date | None = None
    ) -> List[Notification]:
        """Check incomplete tasks past their due date and trigger TASK_OVERDUE notifications."""
        today = target_date or datetime.now(timezone.utc).date()
        start_of_day = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc)

        stmt = (
            select(Task)
            .where(Task.due_date < today, Task.completed_at.is_(None))
            .order_by(Task.user_id, Task.due_date.asc())
        )
        result = await session.execute(stmt)
        overdue_tasks = result.scalars().all()

        by_user: Dict[uuid.UUID, List[Task]] = {}
        for t in overdue_tasks:
            by_user.setdefault(t.user_id, []).append(t)

        notifications = []
        for user_id, user_overdue in by_user.items():
            check_stmt = select(Notification).where(
                Notification.user_id == user_id,
                Notification.type == NotificationType.TASK_OVERDUE,
                Notification.created_at >= start_of_day,
            )
            existing = (await session.execute(check_stmt)).scalars().first()
            if existing:
                continue

            first_task = user_overdue[0]
            noti = await notifications_service.create(
                session,
                NotificationCreate(
                    user_id=user_id,
                    type=NotificationType.TASK_OVERDUE,
                    data={
                        "task_count": len(user_overdue),
                        "task_title": first_task.title[:50],
                    },
                ),
            )
            notifications.append(noti)

        return notifications

    async def run_all_checks(self, session: AsyncSession) -> Dict[str, int]:
        """Run all 3 goal notification checks in a single pass."""
        reminders = await self.check_daily_reminders(session)
        due_soon = await self.check_due_soon_tasks(session)
        overdue = await self.check_overdue_tasks(session)
        return {
            "daily_reminders": len(reminders),
            "due_soon": len(due_soon),
            "overdue": len(overdue),
        }
