import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings
import sqlalchemy

async def run_migration():
    engine = create_async_engine(str(settings.database_url).replace("postgresql://", "postgresql+asyncpg://"))
    
    with open("docs/db/migrations/035_enable_pg_trgm_fuzzy_hashtag_search.sql", "r", encoding="utf-8") as f:
        sql_script = f.read()
    
    # Simple split by ';' to execute statements individually, or just use engine.execute
    # In asyncpg, executing multiple statements in one string using conn.execute doesn't always work perfectly,
    # but we can try to run it. Or we can strip BEGIN/COMMIT and run individually.
    
    async with engine.begin() as conn:
        # Actually asyncpg can handle multiple statements if they don't contain parameters.
        # But we'll just run it as text. 
        await conn.execute(sqlalchemy.text(sql_script))
        print("Migration 035 executed successfully!")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run_migration())
