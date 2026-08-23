import asyncio
from app.db.session import get_db_session
from sqlalchemy import text

async def main():
    async for session in get_db_session():
        result = await session.execute(text("SELECT id, content, attachment_path FROM messages WHERE attachment_path IS NOT NULL LIMIT 5"))
        for row in result:
            print(row)
        break

if __name__ == "__main__":
    asyncio.run(main())
