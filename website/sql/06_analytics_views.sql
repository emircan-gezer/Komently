-- ============================================================
-- 06_analytics_views.sql
-- Views for fast analytics retrieval in the dashboard
-- Run AFTER 01_schema.sql and 04_ai_moderation.sql
-- ============================================================

-- Daily comment volume and moderation status for charts
CREATE OR REPLACE VIEW section_analytics_daily AS
SELECT
    section_id,
    DATE(created_at) AS date,
    COUNT(*) AS total_comments,
    COUNT(*) FILTER (WHERE moderation_status = 'approved') AS approved_comments,
    COUNT(*) FILTER (WHERE moderation_status = 'rejected') AS rejected_comments,
    COUNT(*) FILTER (WHERE moderation_status = 'pending') AS pending_comments
FROM comments
WHERE is_deleted = false
GROUP BY section_id, DATE(created_at);

-- Aggregate summary for top-level metrics per section
CREATE OR REPLACE VIEW section_analytics_summary AS
SELECT
    section_id,
    COUNT(*) AS total_comments,
    COUNT(*) FILTER (WHERE moderation_status = 'approved') AS approved_comments,
    COUNT(*) FILTER (WHERE moderation_status = 'rejected') AS rejected_comments,
    COUNT(*) FILTER (WHERE moderation_status = 'pending') AS pending_comments,
    -- Comments in the last 7 days
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS comments_this_week,
    -- Overall approval rate (percentage)
    CASE 
        WHEN COUNT(*) = 0 THEN 0 
        ELSE (COUNT(*) FILTER (WHERE moderation_status = 'approved')::float / COUNT(*)::float) * 100.0
    END AS approval_rate
FROM comments
WHERE is_deleted = false
GROUP BY section_id;
