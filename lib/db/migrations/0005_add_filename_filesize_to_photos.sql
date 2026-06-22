-- Migration: Add filename and filesize columns to photos table for duplicate detection
-- Applied: 2026-06-22

ALTER TABLE photos ADD COLUMN IF NOT EXISTS filename TEXT;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS filesize INTEGER;
