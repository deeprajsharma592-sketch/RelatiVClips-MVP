import os
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://relativ_admin:relativ_secure_pass@localhost:5432/relativ_db"
)

if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(DATABASE_URL, echo=False, pool_size=5, max_overflow=10)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

_DB_AVAILABLE = False


async def get_session() -> AsyncSession:
    if not _DB_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable — running in memory-only mode"
        )
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    global _DB_AVAILABLE
    from .models import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    _DB_AVAILABLE = True


async def close_db():
    global _DB_AVAILABLE
    _DB_AVAILABLE = False
    await engine.dispose()
