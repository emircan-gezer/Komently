-- ============================================================
-- Komently — Migration: add name + status to comment_sections
-- Run this AFTER 01_schema.sql if you already ran it,
-- OR add these columns directly to 01_schema.sql before first run.
-- ============================================================

ALTER TABLE comment_sections
    ADD COLUMN IF NOT EXISTS name   TEXT NOT NULL DEFAULT 'Untitled Section',
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused'));
