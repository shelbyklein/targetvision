-- Migration: Add thumbnail_key column to photos table
-- Applied: 2026-05-13

ALTER TABLE photos ADD COLUMN IF NOT EXISTS thumbnail_key TEXT;
