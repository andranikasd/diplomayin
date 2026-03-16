-- Migration 0011: market_data table
-- Stores web-researched, AI-extracted market intelligence data
-- Auto-populated on demand when users query topics not in the DB
-- Schema is flexible (entity + attribute pattern) so any topic can be stored

CREATE TABLE IF NOT EXISTS market_data (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    topic       TEXT    NOT NULL,             -- normalized slug, e.g. 'cigarette_brands_armenia'
    entity      TEXT    NOT NULL DEFAULT '',  -- the thing measured: brand, company, product, person
    attribute   TEXT    NOT NULL DEFAULT 'value', -- what is measured: 'market_share_pct', 'rank', 'count'
    value       TEXT,                         -- text representation
    value_num   REAL,                         -- numeric value (NULL if not numeric)
    unit        TEXT,                         -- '%', 'AMD', 'stores', 'tonnes'
    location    TEXT    NOT NULL DEFAULT 'Armenia', -- country, city, or region
    period      TEXT    NOT NULL DEFAULT '',  -- '2023', '2024', 'Q1 2024', etc.
    source_url  TEXT,
    source_name TEXT,
    confidence  TEXT    DEFAULT 'medium',     -- 'high', 'medium', 'low'
    created_at  TEXT    DEFAULT CURRENT_TIMESTAMP
);

-- Unique per data point to prevent duplicates on repeated research
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_data_unique
    ON market_data(topic, entity, attribute, location, period);

-- Fast lookup by topic for cache checks and re-querying
CREATE INDEX IF NOT EXISTS idx_market_data_topic ON market_data(topic);
CREATE INDEX IF NOT EXISTS idx_market_data_created ON market_data(created_at);
