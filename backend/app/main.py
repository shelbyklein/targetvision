from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import os
from pathlib import Path

from app.core.config import settings
from app.api import photos, chat, health

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="A web-based RAG application for intelligent photo search and chat",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

uploads_dir = Path(settings.UPLOAD_DIR)
uploads_dir.mkdir(exist_ok=True)

if uploads_dir.exists():
    app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

app.include_router(health.router, prefix="/api/health", tags=["health"])
app.include_router(photos.router, prefix="/api/photos", tags=["photos"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])

@app.get("/")
async def root():
    return {
        "message": "Welcome to TargetVision Photo RAG API",
        "docs": "/api/docs",
        "health": "/api/health"
    }

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )