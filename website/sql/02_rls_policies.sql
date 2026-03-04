-- ============================================================
-- Komently — Row-Level Security (RLS) Policies
-- Run AFTER 01_schema.sql
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE commenters       ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes            ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- COMMENTERS
-- Your API (service role) manages commenters; no direct client
-- access needed. Adjust if you want public registration.
-- ============================================================
CREATE POLICY "service role full access on commenters"
    ON commenters FOR ALL
    USING (TRUE)
    WITH CHECK (TRUE);

-- ============================================================
-- COMMENT SECTIONS
-- Readable by anyone; writable only by authenticated site owners.
-- ============================================================
CREATE POLICY "anyone can read sections"
    ON comment_sections FOR SELECT
    USING (TRUE);

CREATE POLICY "owner can manage their sections"
    ON comment_sections FOR ALL
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- ============================================================
-- COMMENTS — public reads, API-controlled writes
-- ============================================================
CREATE POLICY "anyone can read non-deleted comments"
    ON comments FOR SELECT
    USING (is_deleted = FALSE);

CREATE POLICY "service role can insert comments"
    ON comments FOR INSERT
    WITH CHECK (TRUE);

CREATE POLICY "service role can update comments"
    ON comments FOR UPDATE
    USING (TRUE)
    WITH CHECK (TRUE);

-- ============================================================
-- VOTES — public reads, API-controlled writes
-- ============================================================
CREATE POLICY "anyone can read votes"
    ON votes FOR SELECT
    USING (TRUE);

CREATE POLICY "service role can manage votes"
    ON votes FOR ALL
    USING (TRUE)
    WITH CHECK (TRUE);
