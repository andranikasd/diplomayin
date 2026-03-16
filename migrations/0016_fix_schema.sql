-- Migration 0016: Fix schema inconsistencies
-- 1. Create news_entities table (scraper writes entities here; 0001 only had news_companies)
-- Note: ai_processed column is handled by 0006_ai_pipeline.sql — not repeated here

-- ── news_entities junction table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS news_entities (
    news_id   INTEGER REFERENCES news_articles(id) ON DELETE CASCADE,
    entity_id INTEGER REFERENCES entities(id)      ON DELETE CASCADE,
    PRIMARY KEY (news_id, entity_id)
);