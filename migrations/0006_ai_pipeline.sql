-- AI pipeline columns for news_articles
-- ai_processed: tracks whether AI enrichment has run on this article
-- Note: sentiment column already exists in base schema (0001) — not added here
ALTER TABLE news_articles ADD COLUMN ai_processed INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_news_ai_processed ON news_articles(ai_processed);
