import uuid
from datetime import datetime, timedelta, timezone

from dateutil.relativedelta import relativedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.enums import BanType, ForumModerationActionType, ReportStatus
from app.moderation.dto.moderation_dto import BanCreate, ReportCreate
from app.moderation.entities.moderation_entity import ForumModerationAction, UserBan, UserReport


class ModerationService:
    @staticmethod
    def format_ban_message(ban: UserBan, action_label: str) -> str:
        """Vietnamese by design (unlike this codebase's normal English HTTPException
        details) -- this message is meant to be read verbatim by the blocked end user, not a
        programmer-facing 403. Shared across forum/groups/messages so the wording stays
        consistent everywhere a ban blocks an action."""
        until = "vĩnh viễn" if ban.expires_at is None else f"đến {ban.expires_at.strftime('%d/%m/%Y %H:%M')}"
        reason_part = f" Lý do: {ban.reason}." if ban.reason else ""
        return f"Bạn đang bị cấm {action_label} {until}.{reason_part}"

    @staticmethod
    def compute_expires_at(
        duration_type: str, duration_value: int | None, custom_expires_at: datetime | None
    ) -> datetime | None:
        """None means permanent. `custom_expires_at` is trusted as-is (already validated to be
        present when duration_type == 'custom' by BanCreate)."""
        if duration_type == "permanent":
            return None
        if duration_type == "custom":
            return custom_expires_at
        now = datetime.now(timezone.utc)
        if duration_type == "day":
            return now + timedelta(days=duration_value or 1)
        if duration_type == "week":
            return now + timedelta(weeks=duration_value or 1)
        if duration_type == "month":
            return now + relativedelta(months=duration_value or 1)
        if duration_type == "year":
            return now + relativedelta(years=duration_value or 1)
        raise ValueError(f"Unknown duration_type: {duration_type}")

    @staticmethod
    def _is_active(ban: UserBan) -> bool:
        if ban.revoked_at is not None:
            return False
        if ban.expires_at is None:
            return True
        expires_at = ban.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        return expires_at > datetime.now(timezone.utc)

    async def get_active_ban(self, session: AsyncSession, user_id: uuid.UUID, ban_type: BanType) -> UserBan | None:
        result = await session.execute(
            select(UserBan)
            .where(UserBan.user_id == user_id, UserBan.ban_type == ban_type, UserBan.revoked_at.is_(None))
            .order_by(UserBan.created_at.desc())
        )
        for ban in result.scalars().all():
            if self._is_active(ban):
                return ban
        return None

    async def create_ban(
        self, session: AsyncSession, data: BanCreate, created_by: uuid.UUID
    ) -> list[UserBan]:
        expires_at = self.compute_expires_at(data.duration_type, data.duration_value, data.custom_expires_at)
        created: list[UserBan] = []
        for ban_type in data.ban_types:
            existing = await self.get_active_ban(session, data.user_id, ban_type)
            if existing is not None:
                existing.revoked_at = datetime.now(timezone.utc)
                existing.revoked_by = created_by

            ban = UserBan(
                user_id=data.user_id,
                ban_type=ban_type,
                reason=data.reason,
                created_by=created_by,
                expires_at=expires_at,
            )
            session.add(ban)
            await self.log_action(
                session,
                moderator_id=created_by,
                action=ForumModerationActionType.BAN_USER,
                target_user_id=data.user_id,
                reason=data.reason,
            )
            created.append(ban)
        await session.flush()
        return created

    async def revoke_ban(self, session: AsyncSession, ban: UserBan, revoked_by: uuid.UUID) -> UserBan:
        ban.revoked_at = datetime.now(timezone.utc)
        ban.revoked_by = revoked_by
        await self.log_action(
            session,
            moderator_id=revoked_by,
            action=ForumModerationActionType.UNBAN_USER,
            target_user_id=ban.user_id,
        )
        await session.flush()
        return ban

    async def get_ban_by_id(self, session: AsyncSession, ban_id: uuid.UUID) -> UserBan | None:
        return await session.get(UserBan, ban_id)

    async def list_bans_for_user(
        self, session: AsyncSession, user_id: uuid.UUID, active_only: bool = False
    ) -> list[UserBan]:
        result = await session.execute(
            select(UserBan).where(UserBan.user_id == user_id).order_by(UserBan.created_at.desc())
        )
        bans = list(result.scalars().all())
        if active_only:
            bans = [b for b in bans if self._is_active(b)]
        return bans

    async def list_bans(
        self,
        session: AsyncSession,
        ban_type: BanType | None = None,
        active_only: bool = True,
        skip: int = 0,
        limit: int = 50,
    ) -> list[UserBan]:
        stmt = select(UserBan).options(
            selectinload(UserBan.user)
        ).order_by(UserBan.created_at.desc())
        if ban_type is not None:
            stmt = stmt.where(UserBan.ban_type == ban_type)
        result = await session.execute(stmt)
        bans = list(result.scalars().all())
        if active_only:
            bans = [b for b in bans if self._is_active(b)]
        return bans[skip : skip + limit]

    async def log_action(
        self,
        session: AsyncSession,
        moderator_id: uuid.UUID,
        action: ForumModerationActionType,
        target_user_id: uuid.UUID | None = None,
        target_id: uuid.UUID | None = None,
        reason: str | None = None,
    ) -> ForumModerationAction:
        entry = ForumModerationAction(
            moderator_id=moderator_id,
            action=action,
            target_user_id=target_user_id,
            target_id=target_id,
            reason=reason,
        )
        session.add(entry)
        await session.flush()
        return entry

    async def list_actions(
        self,
        session: AsyncSession,
        moderator_id: uuid.UUID | None = None,
        target_user_id: uuid.UUID | None = None,
        action: ForumModerationActionType | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[ForumModerationAction]:
        stmt = select(ForumModerationAction).options(
            selectinload(ForumModerationAction.moderator), selectinload(ForumModerationAction.target_user)
        ).order_by(ForumModerationAction.created_at.desc())
        if moderator_id is not None:
            stmt = stmt.where(ForumModerationAction.moderator_id == moderator_id)
        if target_user_id is not None:
            stmt = stmt.where(ForumModerationAction.target_user_id == target_user_id)
        if action is not None:
            stmt = stmt.where(ForumModerationAction.action == action)
        stmt = stmt.offset(skip).limit(limit)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    # --- Reports ---

    async def create_report(self, session: AsyncSession, data: ReportCreate, reporter_id: uuid.UUID) -> UserReport:
        report = UserReport(
            reporter_id=reporter_id,
            reported_user_id=data.reported_user_id,
            reason=data.reason,
            description=data.description,
        )
        session.add(report)
        await session.flush()
        return report

    async def get_report_by_id(self, session: AsyncSession, report_id: uuid.UUID) -> UserReport | None:
        return await session.get(UserReport, report_id)

    async def list_reports(
        self,
        session: AsyncSession,
        status_filter: ReportStatus | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[UserReport]:
        stmt = select(UserReport).options(
            selectinload(UserReport.reporter), selectinload(UserReport.reported_user)
        ).order_by(UserReport.created_at.desc())
        if status_filter is not None:
            stmt = stmt.where(UserReport.status == status_filter)
        stmt = stmt.offset(skip).limit(limit)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def update_report_status(
        self,
        session: AsyncSession,
        report: UserReport,
        status: ReportStatus,
        resolved_by: uuid.UUID,
        resolution_note: str | None = None,
    ) -> UserReport:
        report.status = status
        report.resolved_at = datetime.now(timezone.utc)
        report.resolved_by = resolved_by
        report.resolution_note = resolution_note
        await session.flush()
        return report
