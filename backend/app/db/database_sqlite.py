"""SQLite database setup for testing without PostgreSQL"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Use SQLite for testing
DATABASE_URL = "sqlite:///./targetvision_test.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # Needed for SQLite
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize the database tables"""
    from app.models import photo, chat  # Import models to register them
    Base.metadata.create_all(bind=engine)
    print("✅ SQLite database initialized")