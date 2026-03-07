-- ============================================================
-- Komently — Performance Indexes
-- Improves performance for comment fetching, moderation,
-- threading, pagination and voting queries.
-- ============================================================

-- ------------------------------------------------------------
-- COMMENTS
-- ------------------------------------------------------------

-- Fetch comments by section quickly
CREATE INDEX IF NOT EXISTS idx_comments_section_created
ON comments(section_id, created_at DESC);

-- Fetch replies by parent
CREATE INDEX IF NOT EXISTS idx_comments_parent_created
ON comments(parent_id, created_at ASC);

-- Moderation queries
CREATE INDEX IF NOT EXISTS idx_comments_section_moderation
ON comments(section_id, moderation_status);

-- Fast lookup for approved comments only
CREATE INDEX IF NOT EXISTS idx_comments_approved
ON comments(section_id)
WHERE moderation_status = 'approved' AND is_deleted = FALSE;

-- Pagination for top-level comments
CREATE INDEX IF NOT EXISTS idx_comments_top_level
ON comments(section_id, created_at DESC)
WHERE parent_id IS NULL;

-- ------------------------------------------------------------
-- VOTES
-- ------------------------------------------------------------

-- Fast vote aggregation
CREATE INDEX IF NOT EXISTS idx_votes_comment_value
ON votes(comment_id, value);

-- Fast lookup of user's vote on a comment
CREATE INDEX IF NOT EXISTS idx_votes_commenter_lookup
ON votes(commenter_id, comment_id);

-- ------------------------------------------------------------
-- COMMENTERS
-- ------------------------------------------------------------

-- Useful if usernames become searchable later
CREATE INDEX IF NOT EXISTS idx_commenters_username
ON commenters(username);

-- ------------------------------------------------------------
-- COMMENT SECTIONS
-- ------------------------------------------------------------

-- Faster section resolution by public_id
CREATE INDEX IF NOT EXISTS idx_sections_public
ON comment_sections(public_id);

-- Owner dashboard queries
CREATE INDEX IF NOT EXISTS idx_sections_owner
ON comment_sections(owner_id);

-- ------------------------------------------------------------
-- JSONB SETTINGS (future proof)
-- Allows querying settings fields efficiently
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_sections_settings
ON comment_sections
USING GIN (settings);

-- ------------------------------------------------------------
-- AI MODERATION METADATA
-- Useful if you later filter flagged / spam comments
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_comments_spam
ON comments(is_spam)
WHERE is_spam = TRUE;

CREATE INDEX IF NOT EXISTS idx_comments_toxicity
ON comments(toxicity_score DESC)
WHERE toxicity_score IS NOT NULL;

-- ------------------------------------------------------------
-- THREAD DEPTH OPTIMIZATION
-- Helps recursive reply fetching
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_comments_parent_section
ON comments(parent_id, section_id);