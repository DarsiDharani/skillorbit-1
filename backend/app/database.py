from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "postgresql+asyncpg://postgres:admin123@localhost:5432/skillorbit"

# Create async engine
async_engine = create_async_engine(DATABASE_URL, echo=True, future=True)

# Create async session factory
AsyncSessionLocal = sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False
)

# Create all tables
async def create_db_and_tables():
    # Import here to avoid circular imports
    from app.models import Base
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# Dependency to get DB session (async)
async def get_db_async() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session

get_db = get_db_async