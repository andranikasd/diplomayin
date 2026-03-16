-- Migration 0015: Ensure scraper_jobs table exists for admin observability
-- (may have been created in earlier migrations; this is idempotent)

CREATE TABLE IF NOT EXISTS scraper_jobs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  source      TEXT NOT NULL,         -- 'worldbank', 'imf', 'exchange_rates', 'news', 'research'
  status      TEXT NOT NULL DEFAULT 'running',  -- 'running', 'completed', 'failed'
  items_scraped INTEGER NOT NULL DEFAULT 0,
  error_msg   TEXT,
  duration_ms INTEGER,
  started_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sj_source  ON scraper_jobs(source);
CREATE INDEX IF NOT EXISTS idx_sj_status  ON scraper_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sj_started ON scraper_jobs(started_at);
