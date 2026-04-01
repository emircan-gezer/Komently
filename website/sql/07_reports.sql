-- 07_reports.sql
-- Schema for storing AI-generated section reports

CREATE TABLE IF NOT EXISTS section_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_id UUID REFERENCES comment_sections(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'processing', -- 'processing', 'completed', 'failed'
    report_content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Index for fast lookups by section
CREATE INDEX IF NOT EXISTS idx_section_reports_section_id ON section_reports(section_id);
