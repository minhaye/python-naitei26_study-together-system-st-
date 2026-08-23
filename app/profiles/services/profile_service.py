import uuid
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.enums import ProfileRole
from app.profiles.entities.profile_entity import Profile
from app.profiles.dto.profile_dto import ProfileCreate, ProfileUpdate


class ProfilesService:
    async def create(self, session: AsyncSession, data: ProfileCreate) -> Profile:
        profile = Profile(**data.model_dump())
        session.add(profile)
        await session.flush()
        return profile

    async def get_by_id(self, session: AsyncSession, profile_id: uuid.UUID) -> Profile | None:
        return await session.get(Profile, profile_id)

    async def get_by_username(self, session: AsyncSession, username: str) -> Profile | None:
        result = await session.execute(select(Profile).where(Profile.username == username))
        return result.scalar_one_or_none()

    async def list_all(self, session: AsyncSession, skip: int = 0, limit: int = 50) -> list[Profile]:
        result = await session.execute(select(Profile).offset(skip).limit(limit))
        return list(result.scalars().all())

    async def search(self, session: AsyncSession, query: str, skip: int = 0, limit: int = 20) -> list[Profile]:
        """ILIKE match on username/display_name -- backs the moderator dashboard's
        user-search box (ban creation, role grants). Not for public use (no auth-level
        restriction here, callers must gate access themselves)."""
        clean_q = query.strip()
        if not clean_q:
            return []
        pattern = f"%{clean_q}%"
        result = await session.execute(
            select(Profile)
            .where(or_(Profile.username.ilike(pattern), Profile.display_name.ilike(pattern)))
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def list_by_role(self, session: AsyncSession, roles: list[ProfileRole]) -> list[Profile]:
        result = await session.execute(select(Profile).where(Profile.role.in_(roles)))
        return list(result.scalars().all())

    async def update(self, session: AsyncSession, profile: Profile, data: ProfileUpdate) -> Profile:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(profile, field, value)
        await session.flush()
        return profile

    async def delete(self, session: AsyncSession, profile: Profile) -> None:
        await session.delete(profile)
        await session.flush()
