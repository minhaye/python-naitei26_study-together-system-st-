import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_admin, require_forum_moderator
from app.auth.dto.auth_dto import CurrentUser
from app.db.enums import BanType, ForumModerationActionType, ProfileRole, ReportStatus
from app.db.session import get_db_session
from app.moderation.dto.moderation_dto import (
    BanCreate,
    BanResponse,
    ModerationActionResponse,
    ReportCreate,
    ReportResponse,
    ReportStatusUpdate,
    RoleUpdate,
)
from app.moderation.entities.moderation_entity import ForumModerationAction, UserBan, UserReport
from app.moderation.services.moderation_service import ModerationService
from app.profiles.dto.profile_dto import ProfileResponse
from app.profiles.entities.profile_entity import Profile
from app.profiles.services.profile_service import ProfilesService

router = APIRouter(prefix="/moderation", tags=["Moderation"])
service = ModerationService()
profiles_service = ProfilesService()


def _ban_response(ban: UserBan, user: Profile | None = None, created_by_profile: Profile | None = None) -> BanResponse:
    resp = BanResponse.model_validate(ban)
    if user is not None:
        resp.user_name = user.display_name or user.username
    if created_by_profile is not None:
        resp.created_by_name = created_by_profile.display_name or created_by_profile.username
    return resp


def _action_response(
    entry: ForumModerationAction, moderator: Profile | None = None, target: Profile | None = None
) -> ModerationActionResponse:
    resp = ModerationActionResponse.model_validate(entry)
    if moderator is not None:
        resp.moderator_name = moderator.display_name or moderator.username
    if target is not None:
        resp.target_user_name = target.display_name or target.username
    return resp


def _report_response(
    report: UserReport, reporter: Profile | None = None, reported_user: Profile | None = None
) -> ReportResponse:
    resp = ReportResponse.model_validate(report)
    if reporter is not None:
        resp.reporter_name = reporter.display_name or reporter.username
    if reported_user is not None:
        resp.reported_user_name = reported_user.display_name or reported_user.username
    return resp


# --- User search / moderator management ---


@router.get("/users/search", response_model=list[ProfileResponse])
async def search_users(
    q: str = "",
    limit: int = 20,
    _current_user: CurrentUser = Depends(require_forum_moderator),
    session: AsyncSession = Depends(get_db_session),
):
    return await profiles_service.search(session, q, limit=limit)


@router.get("/moderators", response_model=list[ProfileResponse])
async def list_moderators(
    _current_user: CurrentUser = Depends(require_forum_moderator),
    session: AsyncSession = Depends(get_db_session),
):
    return await profiles_service.list_by_role(session, [ProfileRole.MODERATOR, ProfileRole.ADMIN])


@router.put("/users/{user_id}/role", response_model=ProfileResponse)
async def update_user_role(
    user_id: uuid.UUID,
    data: RoleUpdate,
    current_user: CurrentUser = Depends(require_admin),
    session: AsyncSession = Depends(get_db_session),
):
    profile = await profiles_service.get_by_id(session, user_id)
    if not profile:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if profile.id == current_user.id and data.role != ProfileRole.ADMIN:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot revoke your own Admin role")

    try:
        old_role = profile.role
        profile.role = data.role
        action = (
            ForumModerationActionType.GRANT_MODERATOR
            if data.role in (ProfileRole.MODERATOR, ProfileRole.ADMIN)
            else ForumModerationActionType.REVOKE_MODERATOR
        )
        if old_role != data.role:
            await service.log_action(session, moderator_id=current_user.id, action=action, target_user_id=user_id)
        await session.commit()
        return profile
    except Exception as e:
        await session.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Could not update role: {str(e)}")


# --- Bans ---


@router.get("/bans/me", response_model=list[BanResponse])
async def list_my_bans(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Self-service: any authenticated user (no moderator role required, unlike every other
    /moderation/* read below) can see their OWN active restrictions -- lets the frontend show
    them up front instead of only surfacing a ban after a blocked action's 403."""
    bans = await service.list_bans_for_user(session, current_user.id, active_only=True)
    return [_ban_response(b) for b in bans]


@router.post("/bans", response_model=list[BanResponse], status_code=status.HTTP_201_CREATED)
async def create_ban(
    data: BanCreate,
    current_user: CurrentUser = Depends(require_forum_moderator),
    session: AsyncSession = Depends(get_db_session),
):
    target = await profiles_service.get_by_id(session, data.user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if target.id == current_user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot ban yourself")

    try:
        bans = await service.create_ban(session, data, created_by=current_user.id)
        await session.commit()
        moderator_profile = await profiles_service.get_by_id(session, current_user.id)
        return [_ban_response(b, user=target, created_by_profile=moderator_profile) for b in bans]
    except Exception as e:
        await session.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Could not create ban: {str(e)}")


@router.get("/bans", response_model=list[BanResponse])
async def list_bans(
    user_id: uuid.UUID | None = None,
    ban_type: BanType | None = None,
    active_only: bool = True,
    skip: int = 0,
    limit: int = 50,
    _current_user: CurrentUser = Depends(require_forum_moderator),
    session: AsyncSession = Depends(get_db_session),
):
    if user_id is not None:
        bans = await service.list_bans_for_user(session, user_id, active_only=active_only)
        bans = bans[skip : skip + limit]
    else:
        bans = await service.list_bans(session, ban_type=ban_type, active_only=active_only, skip=skip, limit=limit)
    return [_ban_response(b, user=b.user) for b in bans]


@router.get("/users/{user_id}/bans", response_model=list[BanResponse])
async def list_user_bans(
    user_id: uuid.UUID,
    active_only: bool = False,
    _current_user: CurrentUser = Depends(require_forum_moderator),
    session: AsyncSession = Depends(get_db_session),
):
    bans = await service.list_bans_for_user(session, user_id, active_only=active_only)
    return [_ban_response(b) for b in bans]


@router.delete("/bans/{ban_id}", response_model=BanResponse)
async def revoke_ban(
    ban_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_forum_moderator),
    session: AsyncSession = Depends(get_db_session),
):
    ban = await service.get_ban_by_id(session, ban_id)
    if not ban:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ban not found")
    try:
        updated = await service.revoke_ban(session, ban, revoked_by=current_user.id)
        await session.commit()
        return _ban_response(updated)
    except Exception as e:
        await session.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Could not revoke ban: {str(e)}")


# --- Audit log ---


@router.get("/actions", response_model=list[ModerationActionResponse])
async def list_actions(
    moderator_id: uuid.UUID | None = None,
    target_user_id: uuid.UUID | None = None,
    action: ForumModerationActionType | None = None,
    skip: int = 0,
    limit: int = 50,
    _current_user: CurrentUser = Depends(require_forum_moderator),
    session: AsyncSession = Depends(get_db_session),
):
    entries = await service.list_actions(
        session,
        moderator_id=moderator_id,
        target_user_id=target_user_id,
        action=action,
        skip=skip,
        limit=limit,
    )
    return [_action_response(e, moderator=e.moderator, target=e.target_user) for e in entries]


# --- Reports ---


@router.post("/reports", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    data: ReportCreate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Any authenticated user can report another user (not moderator-gated, like
    /bans/me above) -- surfaced to moderators via GET /reports below, which IS gated."""
    if data.reported_user_id == current_user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot report yourself")
    target = await profiles_service.get_by_id(session, data.reported_user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    try:
        report = await service.create_report(session, data, reporter_id=current_user.id)
        await session.commit()
        reporter_profile = await profiles_service.get_by_id(session, current_user.id)
        return _report_response(report, reporter=reporter_profile, reported_user=target)
    except Exception as e:
        await session.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Could not create report: {str(e)}")


@router.get("/reports", response_model=list[ReportResponse])
async def list_reports(
    status_filter: ReportStatus | None = ReportStatus.PENDING,
    skip: int = 0,
    limit: int = 50,
    _current_user: CurrentUser = Depends(require_forum_moderator),
    session: AsyncSession = Depends(get_db_session),
):
    reports = await service.list_reports(session, status_filter=status_filter, skip=skip, limit=limit)
    return [_report_response(r, reporter=r.reporter, reported_user=r.reported_user) for r in reports]


@router.patch("/reports/{report_id}", response_model=ReportResponse)
async def update_report_status(
    report_id: uuid.UUID,
    data: ReportStatusUpdate,
    current_user: CurrentUser = Depends(require_forum_moderator),
    session: AsyncSession = Depends(get_db_session),
):
    report = await service.get_report_by_id(session, report_id)
    if not report:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found")
    try:
        updated = await service.update_report_status(
            session, report, status=data.status, resolved_by=current_user.id, resolution_note=data.resolution_note
        )
        await session.commit()
        return _report_response(updated)
    except Exception as e:
        await session.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Could not update report: {str(e)}")
