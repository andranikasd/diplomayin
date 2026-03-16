-- Migration 0012: Unified data_points + entities tables
-- Replaces: statistics, facts, market_data → data_points
-- Replaces: companies → entities

-- ────────────────────────────────────────────────────
-- Universal data table
-- ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_points (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Classification (3-level taxonomy)
  domain       TEXT NOT NULL DEFAULT 'general',
               -- 'demographics', 'economy', 'business', 'health',
               -- 'environment', 'infrastructure', 'social', 'geography', 'politics'
  category     TEXT,           -- 'population', 'gdp', 'brands', 'elections', 'employment'
  subcategory  TEXT,           -- 'by_region', 'age_groups', 'annual'

  -- What is being described
  entity       TEXT NOT NULL DEFAULT '',  -- 'Armenia', 'Yerevan', 'Marlboro', 'Aragatsotn'
  attribute    TEXT NOT NULL,             -- 'total_population', 'market_share_pct', 'gdp_usd'

  -- The value (one or both filled)
  value_text   TEXT,
  value_num    REAL,
  unit         TEXT,           -- '%', 'persons', 'USD', 'AMD', 'kg', 'stores'

  -- Context
  location     TEXT NOT NULL DEFAULT 'Armenia',
  period       TEXT NOT NULL DEFAULT '',  -- '2023', '2023-Q1', '' for timeless facts

  -- Provenance & trust
  source_name  TEXT NOT NULL DEFAULT '',
  source_url   TEXT,
  confidence   TEXT NOT NULL DEFAULT 'medium',
               -- 'high'        = official API (World Bank, IMF, Armstat)
               -- 'medium'      = reputable publication
               -- 'low'         = web-scraped / unverified
               -- 'ai_inferred' = derived by AI

  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Prevent exact duplicates; entity/period/source_name default '' so NULLs never break uniqueness
  UNIQUE(domain, entity, attribute, location, period, source_name)
);

CREATE INDEX IF NOT EXISTS idx_dp_domain    ON data_points(domain);
CREATE INDEX IF NOT EXISTS idx_dp_entity    ON data_points(entity);
CREATE INDEX IF NOT EXISTS idx_dp_attribute ON data_points(attribute);
CREATE INDEX IF NOT EXISTS idx_dp_location  ON data_points(location);
CREATE INDEX IF NOT EXISTS idx_dp_period    ON data_points(period);
CREATE INDEX IF NOT EXISTS idx_dp_created   ON data_points(created_at);
CREATE INDEX IF NOT EXISTS idx_dp_domain_cat ON data_points(domain, category);

-- ────────────────────────────────────────────────────
-- Entities table (replaces companies — wider scope)
-- ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entities (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL UNIQUE,
  type            TEXT NOT NULL DEFAULT 'company',
                  -- 'company', 'brand', 'organization', 'government_body',
                  -- 'ngo', 'university', 'media_outlet', 'political_party'
  domain          TEXT,   -- 'business', 'government', 'civil_society', 'media', 'education'
  industry        TEXT,
  description     TEXT,
  city            TEXT,
  country         TEXT NOT NULL DEFAULT 'Armenia',
  website         TEXT,
  founded_year    INTEGER,
  employee_count  INTEGER,
  revenue_amd     REAL,
  source          TEXT,
  ai_extracted    INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_entities_type     ON entities(type);
CREATE INDEX IF NOT EXISTS idx_entities_domain   ON entities(domain);
CREATE INDEX IF NOT EXISTS idx_entities_industry ON entities(industry);
