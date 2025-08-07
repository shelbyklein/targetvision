from pydantic_settings import BaseSettings
from typing import List
import os
from pathlib import Path

class Settings(BaseSettings):
    APP_NAME: str = "TargetVision Photo RAG"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    SECRET_KEY: str = "change-this-in-production"
    JWT_SECRET_KEY: str = "change-this-jwt-key"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    DATABASE_URL: str = "postgresql://localhost/targetvision"
    
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]
    
    # Anthropic Configuration
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-3-opus-20240229"
    
    # OpenAI Configuration (for embeddings only)
    OPENAI_API_KEY: str = ""
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    
    # Option to use local embeddings instead of OpenAI
    USE_LOCAL_EMBEDDINGS: bool = False
    
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS: List[str] = ["jpg", "jpeg", "png", "gif", "webp"]
    
    REDIS_URL: str = "redis://localhost:6379/0"
    
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_PERIOD: int = 60
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        
settings = Settings()