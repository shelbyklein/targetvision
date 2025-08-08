-- TargetVision MVP Database Schema
-- PostgreSQL with pgvector extension

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

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

-- AI metadata table - stores AI-generated descriptions and embeddings
CREATE TABLE IF NOT EXISTS ai_metadata (
    id SERIAL PRIMARY KEY,
    photo_id INTEGER REFERENCES photos(id) ON DELETE CASCADE,
    description TEXT,
    ai_keywords TEXT[],
    embedding vector(512), -- CLIP ViT-B/32 embeddings
    confidence_score FLOAT,
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
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
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

-- Vector similarity search index (IVFFlat for better performance with large datasets)
CREATE INDEX IF NOT EXISTS idx_embedding_vector ON ai_metadata 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_processing_queue_photo_id ON processing_queue(photo_id);

-- Full-text search indexes for text fields
CREATE INDEX IF NOT EXISTS idx_photos_title_gin ON photos USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_photos_caption_gin ON photos USING gin(to_tsvector('english', caption));
CREATE INDEX IF NOT EXISTS idx_ai_metadata_description_gin ON ai_metadata USING gin(to_tsvector('english', description));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at
CREATE TRIGGER update_photos_updated_at BEFORE UPDATE ON photos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oauth_tokens_updated_at BEFORE UPDATE ON oauth_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample query for vector similarity search
-- SELECT p.*, am.description, 
--        1 - (am.embedding <=> '[your_query_vector]'::vector) as similarity
-- FROM photos p
-- JOIN ai_metadata am ON p.id = am.photo_id
-- WHERE am.embedding IS NOT NULL
-- ORDER BY am.embedding <=> '[your_query_vector]'::vector
-- LIMIT 20;