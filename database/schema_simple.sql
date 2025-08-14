-- TargetVision MVP Database Schema (Simplified for testing)
-- PostgreSQL without pgvector for initial testing

-- Photos table - stores SmugMug photo metadata
CREATE TABLE IF NOT EXISTS photos (
    id SERIAL PRIMARY KEY,
    smugmug_id VARCHAR(255) UNIQUE NOT NULL,
    smugmug_uri VARCHAR(500),
    image_url TEXT,
    thumbnail_url TEXT,
    title VARCHAR(255),
    caption TEXT,
    keywords TEXT[],
    album_name VARCHAR(255),
    album_uri VARCHAR(500),
    width INTEGER,
    height INTEGER,
    format VARCHAR(50),
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- AI metadata table - stores AI-generated descriptions (without embeddings for now)
CREATE TABLE IF NOT EXISTS ai_metadata (
    id SERIAL PRIMARY KEY,
    photo_id INTEGER REFERENCES photos(id) ON DELETE CASCADE,
    description TEXT,
    ai_keywords TEXT[],
    -- embedding will be added when pgvector is configured
    processing_time FLOAT,
    model_version VARCHAR(100),
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    approved BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(photo_id)
);

-- OAuth tokens table - stores SmugMug access tokens
CREATE TABLE IF NOT EXISTS oauth_tokens (
    id SERIAL PRIMARY KEY,
    service VARCHAR(50) DEFAULT 'smugmug',
    access_token TEXT NOT NULL,
    access_token_secret TEXT NOT NULL,
    user_id VARCHAR(255),
    username VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Processing queue table - manages AI processing workflow
CREATE TABLE IF NOT EXISTS processing_queue (
    id SERIAL PRIMARY KEY,
    photo_id INTEGER REFERENCES photos(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',
    priority INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(photo_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_photos_smugmug_id ON photos(smugmug_id);
CREATE INDEX IF NOT EXISTS idx_photos_album_name ON photos(album_name);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_metadata_photo_id ON ai_metadata(photo_id);
CREATE INDEX IF NOT EXISTS idx_ai_metadata_approved ON ai_metadata(approved);
CREATE INDEX IF NOT EXISTS idx_ai_metadata_processed_at ON ai_metadata(processed_at DESC);

CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_processing_queue_photo_id ON processing_queue(photo_id);