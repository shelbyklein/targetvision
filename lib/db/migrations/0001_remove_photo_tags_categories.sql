-- Migration: Remove photo-based tag/category tables; add normalized collection tags schema
-- Applied: 2026-05-13

-- Drop legacy photo tag/category tables (in dependency order)
DROP TABLE IF EXISTS photo_tag_suggestions CASCADE;
DROP TABLE IF EXISTS photo_category_suggestions CASCADE;
DROP TABLE IF EXISTS photo_tags CASCADE;
DROP TABLE IF EXISTS photo_categories CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
-- NOTE: old flat `tags` table (with photoId column) is also dropped if it existed
DROP TABLE IF EXISTS tags CASCADE;

-- Create normalized tags table
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- Create collection_tags junction table
CREATE TABLE IF NOT EXISTS collection_tags (
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (collection_id, tag_id)
);
