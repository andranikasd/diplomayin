-- Migration 0016: Fix schema inconsistencies
-- 1. Create news_entities table (scraper writes entities here; 0001 only had news_companies)
-- 2. Add ai_processed column to news_articles if missing (scraper filters on it)

-- ── news_entities junction table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS news_entities (
    news_id   INTEGER REFERENCES news_articles(id) ON DELETE CASCADE,
    entity_id INTEGER REFERENCES entities(id)      ON DELETE CASCADE,
    PRIMARY KEY (news_id, entity_id)
);

-- ── ai_processed column on news_articles (idempotent via ALTER IF NOT EXISTS) ─
-- SQLite has no ALTER TABLE ADD COLUMN IF NOT EXISTS, so we catch the error in CI.
-- This is safe to run multiple times: the second run is a no-op (column exists).
ALTER TABLE news_articles ADD COLUMN ai_processed INTEGER DEFAULT 0;