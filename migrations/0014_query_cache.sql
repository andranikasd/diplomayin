-- Migration 0014: Cross-user query deduplication cache
-- Prevents re-researching topics already fetched from the web
-- Stored in the same DB for now (plan: move to DB_INT when second D1 is created)

CREATE TABLE IF NOT EXISTS query_cache (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  hash           TEXT NOT NULL UNIQUE,   -- SHA-256(normalized_query) for exact match
  slug           TEXT NOT NULL,          -- snake_case keyword list for fuzzy match
  original_query TEXT NOT NULL,
  sql_generated  TEXT,                   -- SQL that answered this query (if any)
  data_domain    TEXT,                   -- domain in data_points that holds the answer
  result_count   INTEGER NOT NULL DEFAULT 0,
  researched     INTEGER NOT NULL DEFAULT 0,  -- 1 if web research was triggered
  hit_count      INTEGER NOT NULL DEFAULT 0,  -- how many users asked this
  last_hit_at    TEXT,
  expires_at     TEXT,                   -- NULL = never expire
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qc_slug       ON query_cache(slug);
CREATE INDEX IF NOT EXISTS idx_qc_domain     ON query_cache(data_domain);
CREATE INDEX IF NOT EXISTS idx_qc_researched ON query_cache(researched);
CREATE INDEX IF NOT EXISTS idx_qc_created    ON query_cache(created_at);
