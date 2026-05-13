-- Migration: Add cover_photo_id column to collections table
-- Applied: 2026-05-13

ALTER TABLE collections ADD COLUMN IF NOT EXISTS cover_photo_id INTEGER REFERENCES photos(id) ON DELETE SET NULL;
