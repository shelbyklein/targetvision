-- TargetVision Database Initialization Script
-- Creates the database schema with pgvector extension

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create albums table
CREATE TABLE IF NOT EXISTS albums (
    id SERIAL PRIMARY KEY,
    smugmug_id VARCHAR(255) UNIQUE NOT NULL,
    smugmug_uri VARCHAR(500),
    title VARCHAR(255),
    description TEXT,
    keywords TEXT[],
    photo_count INTEGER DEFAULT 0,
    image_count INTEGER DEFAULT 0,
    video_count INTEGER DEFAULT 0,
    album_key VARCHAR(255),
    url_name VARCHAR(255),
    privacy VARCHAR(50),
    security_type VARCHAR(50),
    sort_method VARCHAR(50),
    sort_direction VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create photos table
CREATE TABLE IF NOT EXISTS photos (
    id SERIAL PRIMARY KEY,
    smugmug_id VARCHAR(255) UNIQUE NOT NULL,
    album_id INTEGER REFERENCES albums(id) ON DELETE CASCADE,
    smugmug_uri VARCHAR(500),
    image_url TEXT,
    thumbnail_url TEXT,
    filename VARCHAR(255),
    title VARCHAR(255),
    caption TEXT,
    keywords TEXT[],
    date_taken TIMESTAMP WITH TIME ZONE,
    date_uploaded TIMESTAMP WITH TIME ZONE,
    processing_status VARCHAR(50) DEFAULT 'unprocessed',
    ai_description TEXT,
    ai_keywords TEXT[],
    ai_provider VARCHAR(50),
    ai_model VARCHAR(100),
    ai_processed_at TIMESTAMP WITH TIME ZONE,
    embedding vector(512),
    width INTEGER,
    height INTEGER,
    size_bytes BIGINT,
    format VARCHAR(50),
    is_video BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create collections table
CREATE TABLE IF NOT EXISTS collections (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create photo_collections junction table
CREATE TABLE IF NOT EXISTS photo_collections (
    id SERIAL PRIMARY KEY,
    photo_id INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(photo_id, collection_id)
);

-- Create search_history table
CREATE TABLE IF NOT EXISTS search_history (
    id SERIAL PRIMARY KEY,
    query TEXT NOT NULL,
    results_count INTEGER,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create processing_queue table
CREATE TABLE IF NOT EXISTS processing_queue (
    id SERIAL PRIMARY KEY,
    photo_id INTEGER REFERENCES photos(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',
    priority INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_albums_smugmug_id ON albums(smugmug_id);
CREATE INDEX IF NOT EXISTS idx_photos_smugmug_id ON photos(smugmug_id);
CREATE INDEX IF NOT EXISTS idx_photos_album_id ON photos(album_id);
CREATE INDEX IF NOT EXISTS idx_photos_processing_status ON photos(processing_status);
CREATE INDEX IF NOT EXISTS idx_photos_ai_processed_at ON photos(ai_processed_at);
CREATE INDEX IF NOT EXISTS idx_photo_collections_photo_id ON photo_collections(photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_collections_collection_id ON photo_collections(collection_id);
CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_processing_queue_photo_id ON processing_queue(photo_id);

-- Create vector similarity search index (for AI embeddings)
CREATE INDEX IF NOT EXISTS idx_photos_embedding ON photos USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100)
WHERE embedding IS NOT NULL;

-- Create update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to all tables
CREATE TRIGGER update_albums_updated_at BEFORE UPDATE ON albums
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_photos_updated_at BEFORE UPDATE ON photos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function for full-text search
CREATE OR REPLACE FUNCTION search_photos(search_query TEXT)
RETURNS SETOF photos AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM photos
    WHERE 
        title ILIKE '%' || search_query || '%' OR
        caption ILIKE '%' || search_query || '%' OR
        ai_description ILIKE '%' || search_query || '%' OR
        search_query = ANY(keywords) OR
        search_query = ANY(ai_keywords);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed for your user)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO targetvision;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO targetvision;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO targetvision;