-- Migration: Drop caption column from photos table
-- Applied: 2026-05-13

ALTER TABLE photos DROP COLUMN IF EXISTS caption;
