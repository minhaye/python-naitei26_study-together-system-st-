import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.resource import Resource, ResourceFolder
from app.schemas.resource import ResourceCreate, ResourceFolderCreate, ResourceFolderUpdate, ResourceUpdate

# --- resource_folders ---


async def create_resource_folder(session: AsyncSession, data: ResourceFolderCreate) -> ResourceFolder:
    folder = ResourceFolder(**data.model_dump())
    session.add(folder)
    await session.flush()
    return folder


async def get_resource_folder(session: AsyncSession, folder_id: uuid.UUID) -> ResourceFolder | None:
    return await session.get(ResourceFolder, folder_id)


async def list_resource_folders_by_group(session: AsyncSession, group_id: uuid.UUID) -> list[ResourceFolder]:
    result = await session.execute(select(ResourceFolder).where(ResourceFolder.group_id == group_id))
    return list(result.scalars().all())


async def list_subfolders(session: AsyncSession, parent_folder_id: uuid.UUID) -> list[ResourceFolder]:
    result = await session.execute(
        select(ResourceFolder).where(ResourceFolder.parent_folder_id == parent_folder_id)
    )
    return list(result.scalars().all())


async def update_resource_folder(
    session: AsyncSession, folder: ResourceFolder, data: ResourceFolderUpdate
) -> ResourceFolder:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(folder, field, value)
    await session.flush()
    return folder


async def delete_resource_folder(session: AsyncSession, folder: ResourceFolder) -> None:
    await session.delete(folder)
    await session.flush()


# --- resources ---


async def create_resource(session: AsyncSession, data: ResourceCreate) -> Resource:
    resource = Resource(**data.model_dump())
    session.add(resource)
    await session.flush()
    return resource


async def get_resource(session: AsyncSession, resource_id: uuid.UUID) -> Resource | None:
    return await session.get(Resource, resource_id)


async def list_resources_by_group(session: AsyncSession, group_id: uuid.UUID) -> list[Resource]:
    result = await session.execute(select(Resource).where(Resource.group_id == group_id))
    return list(result.scalars().all())


async def list_resources_by_folder(session: AsyncSession, folder_id: uuid.UUID) -> list[Resource]:
    result = await session.execute(select(Resource).where(Resource.folder_id == folder_id))
    return list(result.scalars().all())


async def update_resource(session: AsyncSession, resource: Resource, data: ResourceUpdate) -> Resource:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(resource, field, value)
    await session.flush()
    return resource


async def delete_resource(session: AsyncSession, resource: Resource) -> None:
    # DB row only: the actual file lives in object storage (Supabase Storage) and
    # must be deleted there separately by the caller.
    await session.delete(resource)
    await session.flush()
