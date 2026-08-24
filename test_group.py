import asyncio
import uuid
from sqlalchemy import text
from app.db.session import SessionLocal
from app.groups.services.group_service import GroupsService
from app.groups.dto.group_dto import GroupCreate, GroupResponse

async def test():
    async with SessionLocal() as session:
        service = GroupsService()
        data = GroupCreate(name='Test Group', is_public=True)
        result = await session.execute(text('SELECT id FROM profiles LIMIT 1'))
        owner_id = result.scalar()
        group = await service.create(session, data, owner_id)
        await session.commit()
        print('Created group')
        try:
            resp = GroupResponse.model_validate(group)
            print("Success:", resp.id)
        except Exception as e:
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
