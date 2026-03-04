-- ============================================================
-- Komently — Supabase Schema
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable UUID extension (usually already enabled on Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- COMMENTERS
-- A "commenter" is a visitor identity, separate from the site
-- owner (Supabase Auth user). Identified by a JWT token issued
-- by your backend or generated client-side.
-- ============================================================
CREATE TABLE IF NOT EXISTS commenters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        TEXT NOT NULL,
    avatar_initial  CHAR(1) GENERATED ALWAYS AS (UPPER(LEFT(username, 1))) STORED,
    color           TEXT NOT NULL DEFAULT '#7c3aed',  -- hex color for avatar bg
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- COMMENT SECTIONS
-- Each website page/post registers a "section" by publicId.
-- owner_id references Supabase Auth (site owners).
-- ============================================================
CREATE TABLE IF NOT EXISTS comment_sections (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id   TEXT NOT NULL UNIQUE,   -- e.g. "my-blog-post-slug"
    owner_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- COMMENTS
-- Self-referencing parent_id enables threaded replies.
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id   UUID NOT NULL REFERENCES comment_sections(id) ON DELETE CASCADE,
    commenter_id UUID NOT NULL REFERENCES commenters(id) ON DELETE CASCADE,
    parent_id    UUID REFERENCES comments(id) ON DELETE CASCADE,  -- NULL = top-level
    body         TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
    is_deleted   BOOLEAN NOT NULL DEFAULT FALSE,   -- soft delete
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER comments_updated_at
    BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- VOTES
-- One row per (commenter, comment). value: +1 or -1.
-- ============================================================
CREATE TABLE IF NOT EXISTS votes (
    commenter_id UUID NOT NULL REFERENCES commenters(id) ON DELETE CASCADE,
    comment_id   UUID NOT NULL REFERENCES comments(id)   ON DELETE CASCADE,
    value        SMALLINT NOT NULL CHECK (value IN (1, -1)),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (commenter_id, comment_id)
);

-- ============================================================
-- VOTE COUNTS VIEW
-- Aggregates likes/dislikes per comment for fast reads.
-- ============================================================
CREATE OR REPLACE VIEW comment_vote_counts AS
SELECT
    comment_id,
    COUNT(*) FILTER (WHERE value =  1) AS likes,
    COUNT(*) FILTER (WHERE value = -1) AS dislikes
FROM votes
GROUP BY comment_id;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_comments_section   ON comments(section_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent    ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_commenter ON comments(commenter_id);
CREATE INDEX IF NOT EXISTS idx_votes_comment      ON votes(comment_id);
