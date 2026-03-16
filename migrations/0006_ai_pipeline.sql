-- AI pipeline columns for news_articles
ALTER TABLE news_articles ADD COLUMN ai_processed INTEGER DEFAULT 0;
ALTER TABLE news_articles ADD COLUMN ai_sentiment  TEXT;

CREATE INDEX IF NOT EXISTS idx_news_ai_processed ON news_articles(ai_processed);
