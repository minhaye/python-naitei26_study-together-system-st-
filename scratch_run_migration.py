import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings
import sqlalchemy

async def run_migration():
    engine = create_async_engine(str(settings.database_url).replace("postgresql://", "postgresql+asyncpg://"))
    async with engine.begin() as conn:
        sql = """
        UPDATE group_streaks
        SET current_streak = FLOOR(RANDOM() * 35)::int,
            highest_streak = FLOOR(RANDOM() * 35)::int + 15;
        """
        await conn.execute(sqlalchemy.text(sql))
    print("Randomized streaks for all groups!")

if __name__ == "__main__":
    import sys
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run_migration())
