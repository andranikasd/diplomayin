-- Armenian OSINT Analytics — Security Schema (D1/SQLite)
-- Run: wrangler d1 execute armdata-db --remote --file=migrations/0002_security.sql
-- All statements use IF NOT EXISTS — safe to re-run on every deploy

-- ── Audit Log ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action     TEXT NOT NULL,
    ip         TEXT,
    user_agent TEXT,
    metadata   TEXT,
    severity   TEXT DEFAULT 'info',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_user   ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_ip     ON audit_log(ip);
CREATE INDEX IF NOT EXISTS idx_audit_ts     ON audit_log(created_at);

-- ── Per-User/IP Rate Limit Tracking ───────────────────────────
CREATE TABLE IF NOT EXISTS rate_limit_log (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    key    TEXT NOT NULL,
    hit_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rl_key_time ON rate_limit_log(key, hit_at);

-- ── IP Allowlist / Denylist ────────────────────────────────────
CREATE TABLE IF NOT EXISTS ip_rules (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_or_cidr TEXT NOT NULL UNIQUE,
    rule_type  TEXT NOT NULL,
    note       TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── 2FA / TOTP ────────────────────────────────────────────────
-- Separate table avoids ALTER TABLE on existing users table
CREATE TABLE IF NOT EXISTS user_totp (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    secret_b32 TEXT NOT NULL,
    enabled    INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Threat Intelligence Cache ──────────────────────────────────
CREATE TABLE IF NOT EXISTS threat_cache (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT NOT NULL,
    query_key  TEXT NOT NULL,
    result     TEXT,
    queried_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(type, query_key)
);
CREATE INDEX IF NOT EXISTS idx_threat_type_key ON threat_cache(type, query_key);

-- ── Anomaly Events ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS anomaly_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    target     TEXT,
    details    TEXT,
    severity   TEXT DEFAULT 'medium',
    resolved   INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_anomaly_resolved ON anomaly_events(resolved);

-- ── Company Relationships (for network graph) ──────────────────
CREATE TABLE IF NOT EXISTS company_relationships (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id    INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    target_id    INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL,
    weight       REAL DEFAULT 1.0,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_id, target_id, relationship)
);
CREATE INDEX IF NOT EXISTS idx_rel_source ON company_relationships(source_id);
CREATE INDEX IF NOT EXISTS idx_rel_target ON company_relationships(target_id);
