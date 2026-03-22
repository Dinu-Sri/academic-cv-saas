"""Database connection and session management"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from typing import Generator
from app.config import settings
from app.models import Base

# Create engine
if settings.ENVIRONMENT == "testing":
    # Use in-memory database for testing
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    # Production/Development
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Initialize database - create all tables"""
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    Get database session
    
    Usage:
        db = next(get_db())
        # or in FastAPI:
        # def endpoint(db: Session = Depends(get_db)):
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def reset_db():
    """Reset database - drop all tables and recreate (USE WITH CAUTION!)"""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
