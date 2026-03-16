-- Migration 0017: Application logs table
-- Captures runtime events (errors, warnings, info) from the AI pipeline,
-- research, scraper triggers, and other system events — visible to admin.

CREATE TABLE IF NOT EXISTS app_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    level       TEXT    NOT NULL DEFAULT 'info',   -- 'info' | 'warn' | 'error'
    source      TEXT    NOT NULL DEFAULT 'api',    -- 'api' | 'scraper' | 'research' | 'ai'
    message     TEXT    NOT NULL,
    metadata    TEXT,                              -- JSON blob (optional)
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_logs_level   ON app_logs(level);
CREATE INDEX IF NOT EXISTS idx_app_logs_source  ON app_logs(source);
CREATE INDEX IF NOT EXISTS idx_app_logs_created ON app_logs(created_at);