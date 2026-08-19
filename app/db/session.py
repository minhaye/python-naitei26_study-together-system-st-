from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.db.engine_config import build_engine_kwargs

# See app/db/engine_config.py: a Supavisor TRANSACTION-pooler DATABASE_URL
# (*.pooler.supabase.com:6543) needs NullPool + prepare_threshold=None to avoid
# psycopg.errors.DuplicatePreparedStatement -- every other DATABASE_URL (direct connection,
# Supavisor session pooler) is unaffected and gets SQLAlchemy's normal defaults.
engine = create_async_engine(settings.database_url, **build_engine_kwargs(settings.database_url))

async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_db_session() -> AsyncSession:
    async with async_session_factory() as session:
        yield session
