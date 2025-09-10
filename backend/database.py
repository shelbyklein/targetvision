from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool, QueuePool
from config import settings
import logging
import os

logger = logging.getLogger(__name__)

# Update DATABASE_URL to use psycopg (v3) instead of psycopg2
database_url = settings.DATABASE_URL.replace("postgresql://", "postgresql+psycopg://")

# Use environment-specific pooling configuration
is_production = os.getenv("ENVIRONMENT", "development") == "production"
pool_size = int(os.getenv("DB_POOL_SIZE", "20" if is_production else "5"))
max_overflow = int(os.getenv("DB_MAX_OVERFLOW", "40" if is_production else "10"))

# Create engine with connection pooling
engine = create_engine(
    database_url,
    poolclass=QueuePool if is_production else NullPool,
    pool_size=pool_size if is_production else None,
    max_overflow=max_overflow if is_production else None,
    pool_pre_ping=True,  # Verify connections before use
    echo=settings.DEBUG and not is_production,  # Log SQL queries in debug mode (not in production)
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create base class for models
Base = declarative_base()

def get_db() -> Session:
    """
    Dependency to get database session.
    Usage in FastAPI endpoints:
    
    @app.get("/endpoint")
    def endpoint(db: Session = Depends(get_db)):
        # Use db session here
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize database tables"""
    try:
        # Import all models to register them with Base
        from models import Photo, AIMetadata, OAuthToken, Album, ProcessingQueue, Collection, CollectionItem
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        return False

def test_connection():
    """Test database connection"""
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            logger.info("Database connection successful")
            return True
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return False