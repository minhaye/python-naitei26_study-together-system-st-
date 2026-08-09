import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
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

    async def update(self, session: AsyncSession, profile: Profile, data: ProfileUpdate) -> Profile:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(profile, field, value)
        await session.flush()
        return profile

    async def delete(self, session: AsyncSession, profile: Profile) -> None:
        await session.delete(profile)
        await session.flush()
