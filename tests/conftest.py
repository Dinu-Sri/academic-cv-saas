"""Test configuration and fixtures"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base
from app.database import get_db


@pytest.fixture(scope="session")
def engine():
    """Create test database engine"""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    return engine


@pytest.fixture(scope="function")
def db_session(engine):
    """Create test database session"""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()
    
    yield session
    
    session.rollback()
    session.close()


@pytest.fixture
def sample_user_data():
    """Sample user data for testing"""
    return {
        "email": "test@example.com",
        "username": "testuser",
        "password": "Test123!",
        "full_name": "Test User"
    }


@pytest.fixture
def sample_cv_data():
    """Sample CV data for testing"""
    return {
        "personal_info": {
            "full_name": "John Doe",
            "email": "john@example.com",
            "phone": "+1234567890",
            "address": "123 Main St"
        },
        "education": [
            {
                "degree": "PhD in Computer Science",
                "institution": "MIT",
                "year": 2020,
                "gpa": "4.0"
            }
        ],
        "experience": [
            {
                "position": "Research Scientist",
                "organization": "Google Research",
                "start_date": "2020-01-01",
                "end_date": "2023-12-31",
                "description": "AI research"
            }
        ],
        "publications": [
            {
                "title": "Deep Learning for NLP",
                "authors": "John Doe, Jane Smith",
                "venue": "NeurIPS",
                "year": 2022
            }
        ]
    }
