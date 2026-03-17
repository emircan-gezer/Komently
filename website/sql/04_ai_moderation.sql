-- ============================================================
-- AI MODERATION SCHEMA UPDATES
-- Adds fields to track AI-driven moderation results on comments.
-- ====================-- ========================================

-- 1. Create an enum for moderation status if it doesn't exist
-- Note: Subabase might require it to be created differently depending on version, 
-- but a text check constraint is often safer for migrations.

-- 2. Add columns to comments table
ALTER TABLE comments 
ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'pending' 
CHECK (moderation_status IN ('pending', 'approved', 'flagged', 'rejected', 'shadow_hidden')),
ADD COLUMN IF NOT EXISTS toxicity_score FLOAT,
ADD COLUMN IF NOT EXISTS is_spam BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_metadata JSONB DEFAULT '{}';

-- 3. Add settings JSONB to comment_sections for expandability
ALTER TABLE comment_sections
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{
    "max_chars": 5000,
    "blacklist": [],
    "ai_moderation_enabled": true,
    "ai_toxicity_threshold": 0.8
}'::jsonb;

-- 4. Add index for performance on moderation queries
CREATE INDEX IF NOT EXISTS idx_comments_moderation_status ON comments(moderation_status);

COMMENT ON COLUMN comments.moderation_status IS 'Current status of the comment after AI/Human moderation.';
COMMENT ON COLUMN comments.toxicity_score IS 'Score from toxicity detection models (0 to 1).';
COMMENT ON COLUMN comments.is_spam IS 'True if the automated spam classifier flags this comment.';
COMMENT ON COLUMN comments.ai_metadata IS 'Raw output or extra metadata from AI models (GPT-4, Perspective, etc.).';
COMMENT ON COLUMN comment_sections.settings IS 'Configurable settings for the comment section (limits, blacklist, AI config).';
