-- Restore Complete Database Schema for TargetVision
-- This migration restores the full schema to match the current models
-- Run this to sync the database with the restored models

BEGIN;

-- ========================================
-- STEP 1: Create Albums table
-- ========================================

CREATE TABLE IF NOT EXISTS albums (
    id SERIAL PRIMARY KEY,
    smugmug_id VARCHAR(255) UNIQUE NOT NULL,
    smugmug_uri VARCHAR(500),
    title VARCHAR(255),
    description TEXT,
    keywords TEXT[] DEFAULT '{}',
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

-- ========================================
-- STEP 2: Update Photos table
-- ========================================

-- Add missing columns to photos table
ALTER TABLE photos ADD COLUMN IF NOT EXISTS album_id INTEGER REFERENCES albums(id);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS processing_status VARCHAR(50) DEFAULT 'not_processed';

-- ========================================
-- STEP 3: Create Collections tables
-- ========================================

CREATE TABLE IF NOT EXISTS collections (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cover_photo_id INTEGER REFERENCES photos(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS collection_items (
    id SERIAL PRIMARY KEY,
    collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    photo_id INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_collection_photo UNIQUE(collection_id, photo_id)
);

-- ========================================
-- STEP 4: Create indexes
-- ========================================

-- Album indexes
CREATE INDEX IF NOT EXISTS idx_albums_smugmug_id ON albums(smugmug_id);
CREATE INDEX IF NOT EXISTS idx_albums_title ON albums(title);

-- Photo indexes (for new columns)
CREATE INDEX IF NOT EXISTS idx_photos_album_id ON photos(album_id);
CREATE INDEX IF NOT EXISTS idx_photos_processing_status ON photos(processing_status);

-- Collection indexes
CREATE INDEX IF NOT EXISTS idx_collections_name ON collections(name);
CREATE INDEX IF NOT EXISTS idx_collection_items_collection_id ON collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_photo_id ON collection_items(photo_id);

-- ========================================
-- STEP 5: Create triggers for updated_at
-- ========================================

-- Albums trigger (drop first in case it exists)
DROP TRIGGER IF EXISTS update_albums_updated_at ON albums;
CREATE TRIGGER update_albums_updated_at 
    BEFORE UPDATE ON albums
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Collections trigger (drop first in case it exists)
DROP TRIGGER IF EXISTS update_collections_updated_at ON collections;
CREATE TRIGGER update_collections_updated_at 
    BEFORE UPDATE ON collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

SELECT 'Schema restoration completed' as status;

-- Check table existence
SELECT 'Albums table: ' || CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'albums'
) THEN 'EXISTS' ELSE 'MISSING' END as albums_table;

SELECT 'Collections table: ' || CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'collections'
) THEN 'EXISTS' ELSE 'MISSING' END as collections_table;

SELECT 'Collection_items table: ' || CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'collection_items'
) THEN 'EXISTS' ELSE 'MISSING' END as collection_items_table;

-- Check new photo columns
SELECT 'Photos album_id column: ' || CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'photos' AND column_name = 'album_id'
) THEN 'EXISTS' ELSE 'MISSING' END as photos_album_id;

SELECT 'Photos processing_status column: ' || CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'photos' AND column_name = 'processing_status'
) THEN 'EXISTS' ELSE 'MISSING' END as photos_processing_status;