-- Migration to add Album table and update Photo table for enhanced album management
-- Run this after backing up your database

BEGIN;

-- Create Albums table
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
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for albums
CREATE INDEX IF NOT EXISTS idx_albums_smugmug_id ON albums(smugmug_id);
CREATE INDEX IF NOT EXISTS idx_albums_title ON albums(title);

-- Add new columns to photos table
ALTER TABLE photos ADD COLUMN IF NOT EXISTS album_id INTEGER REFERENCES albums(id);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS processing_status VARCHAR(50) DEFAULT 'not_processed';

-- Add indexes for new photo columns
CREATE INDEX IF NOT EXISTS idx_photos_album_id ON photos(album_id);
CREATE INDEX IF NOT EXISTS idx_photos_processing_status ON photos(processing_status);

-- Create Albums from existing photo data
INSERT INTO albums (smugmug_id, title, photo_count, created_at)
SELECT 
    COALESCE(album_uri, album_name, 'unknown') as smugmug_id,
    COALESCE(album_name, 'Untitled Album') as title,
    COUNT(*) as photo_count,
    MIN(created_at) as created_at
FROM photos 
WHERE album_name IS NOT NULL 
GROUP BY album_name, album_uri
ON CONFLICT (smugmug_id) DO NOTHING;

-- Update photos to reference albums
UPDATE photos SET album_id = albums.id 
FROM albums 
WHERE photos.album_name = albums.title 
AND photos.album_id IS NULL;

-- Update processing_status based on existing AI metadata
UPDATE photos SET processing_status = 'completed' 
WHERE id IN (
    SELECT DISTINCT photo_id FROM ai_metadata WHERE photo_id IS NOT NULL
);

COMMIT;

-- Verify the migration
SELECT 
    'Albums created: ' || COUNT(*) as result 
FROM albums
UNION ALL
SELECT 
    'Photos with album_id: ' || COUNT(*) as result 
FROM photos WHERE album_id IS NOT NULL
UNION ALL
SELECT 
    'Photos with AI processed: ' || COUNT(*) as result 
FROM photos WHERE processing_status = 'completed';