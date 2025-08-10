import os
from dotenv import load_dotenv
from typing import Optional

load_dotenv()

class Settings:
    """Application configuration settings"""
    
    # SmugMug OAuth Settings
    SMUGMUG_API_KEY: str = os.getenv("SMUGMUG_API_KEY", "")
    SMUGMUG_API_SECRET: str = os.getenv("SMUGMUG_API_SECRET", "")
    SMUGMUG_CALLBACK_URL: str = os.getenv("SMUGMUG_CALLBACK_URL", "http://localhost:8000/auth/callback")
    SMUGMUG_BASE_URL: str = "https://api.smugmug.com"
    SMUGMUG_REQUEST_TOKEN_URL: str = f"{SMUGMUG_BASE_URL}/services/oauth/1.0a/getRequestToken"
    SMUGMUG_AUTHORIZE_URL: str = f"{SMUGMUG_BASE_URL}/services/oauth/1.0a/authorize"
    SMUGMUG_ACCESS_TOKEN_URL: str = f"{SMUGMUG_BASE_URL}/services/oauth/1.0a/getAccessToken"
    SMUGMUG_API_BASE: str = f"{SMUGMUG_BASE_URL}/api/v2"
    
    # Anthropic Claude API Settings
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    ANTHROPIC_MODEL: str = "claude-3-opus-20240229"
    ANTHROPIC_MAX_TOKENS: int = 1024
    
    # OpenAI API Settings  
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    
    # Database Settings
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/targetvision")
    
    # Application Settings
    SECRET_KEY: str = os.getenv("SECRET_KEY", "development-secret-key-change-in-production")
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    PORT: int = int(os.getenv("PORT", 8000))
    MAX_PHOTOS_MVP: int = int(os.getenv("MAX_PHOTOS_MVP", 10000))
    
    # Image Processing Settings
    MAX_IMAGE_WIDTH: int = 2200
    MAX_IMAGE_HEIGHT: int = 2200
    MAX_FILE_SIZE_MB: int = 5
    JPEG_QUALITY: int = 85
    
    # Vector Search Settings
    VECTOR_DIMENSIONS: int = 512  # CLIP ViT-B/32
    MAX_SEARCH_RESULTS: int = 20
    
    # Rate Limiting
    AI_PROCESSING_RATE: float = 1.0  # seconds between API calls
    SMUGMUG_RATE_LIMIT: int = 100  # requests per minute
    
    def validate(self) -> bool:
        """Validate required settings are configured"""
        errors = []
        
        if not self.SMUGMUG_API_KEY:
            errors.append("SMUGMUG_API_KEY not configured")
        if not self.SMUGMUG_API_SECRET:
            errors.append("SMUGMUG_API_SECRET not configured")
        # Note: API keys are optional as they can be provided by users
        # if not self.ANTHROPIC_API_KEY:
        #     errors.append("ANTHROPIC_API_KEY not configured")
        # if not self.OPENAI_API_KEY:
        #     errors.append("OPENAI_API_KEY not configured")
        if not self.DATABASE_URL:
            errors.append("DATABASE_URL not configured")
            
        if errors:
            print("Configuration errors:")
            for error in errors:
                print(f"  - {error}")
            return False
        return True

settings = Settings()

def get_settings() -> Settings:
    """Get application settings instance"""
    return settings