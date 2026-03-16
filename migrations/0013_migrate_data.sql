-- Migration 0013: Migrate existing data into unified tables
-- statistics → data_points (domain = category value from statistics)
-- facts → data_points (domain from category, confidence = 'high')
-- market_data → data_points (domain = 'business')
-- companies → entities (type = 'company')

-- ────────────────────────────────────────────────────
-- statistics → data_points
-- statistics columns: id, category, indicator, value, unit, period, source, region, confidence, created_at
-- ────────────────────────────────────────────────────
INSERT OR IGNORE INTO data_points
  (domain, category, entity, attribute, value_num, unit, location, period, source_name, confidence, created_at)
SELECT
  LOWER(COALESCE(category, 'economy')),  -- domain
  NULL,                                   -- category (no subcategory in old table)
  'Armenia',                              -- entity: national-level stat subject is always Armenia
  indicator,                              -- attribute
  CAST(value AS REAL),                    -- value_num
  unit,                                   -- unit
  COALESCE(region, 'Armenia'),            -- location: region if present, else Armenia
  COALESCE(period, ''),                   -- period
  COALESCE(source, ''),                   -- source_name
  COALESCE(confidence, 'medium'),         -- confidence
  created_at
FROM statistics
WHERE indicator IS NOT NULL;

-- ────────────────────────────────────────────────────
-- facts → data_points
-- facts columns: id, category, key, value, source, created_at
-- ────────────────────────────────────────────────────
INSERT OR IGNORE INTO data_points
  (domain, entity, attribute, value_text, location, period, source_name, confidence, created_at)
SELECT
  LOWER(COALESCE(category, 'general')),  -- domain
  'Armenia',                              -- entity
  key,                                    -- attribute
  value,                                  -- value_text
  'Armenia',                              -- location
  '',                                     -- period (facts are timeless)
  COALESCE(source, ''),                   -- source_name
  'high',                                 -- confidence (facts are curated)
  created_at
FROM facts
WHERE key IS NOT NULL;

-- ────────────────────────────────────────────────────
-- market_data → data_points
-- market_data columns: id, topic, entity, attribute, value, value_num, unit, location, period, source_url, source_name, confidence, created_at
-- ────────────────────────────────────────────────────
INSERT OR IGNORE INTO data_points
  (domain, category, entity, attribute, value_text, value_num, unit, location, period, source_name, source_url, confidence, created_at)
SELECT
  'business',                             -- domain
  topic,                                  -- category (topic slug becomes category)
  COALESCE(entity, ''),                   -- entity
  COALESCE(attribute, 'value'),           -- attribute
  value,                                  -- value_text
  value_num,                              -- value_num
  unit,                                   -- unit
  COALESCE(location, 'Armenia'),          -- location
  COALESCE(period, ''),                   -- period
  COALESCE(source_name, ''),              -- source_name
  source_url,                             -- source_url
  COALESCE(confidence, 'medium'),         -- confidence
  created_at
FROM market_data
WHERE attribute IS NOT NULL OR entity IS NOT NULL;

-- ────────────────────────────────────────────────────
-- companies → entities
-- companies columns: id, name, industry, description, city, country, website,
--                    founded_date, employee_count, revenue_estimate, source, ai_extracted, created_at
-- ────────────────────────────────────────────────────
INSERT OR IGNORE INTO entities
  (name, type, industry, description, city, country, website, founded_year, employee_count, revenue_amd, source, ai_extracted, created_at)
SELECT
  name,
  'company',                              -- type (all companies → type='company')
  industry,
  description,
  city,
  COALESCE(country, 'Armenia'),
  website,
  -- Extract year from founded_date (handles '2005', '2005-01-01', '2005-03-15')
  CASE
    WHEN founded_date GLOB '[0-9][0-9][0-9][0-9]*' THEN CAST(SUBSTR(founded_date, 1, 4) AS INTEGER)
    ELSE NULL
  END,
  employee_count,
  revenue_estimate,
  source,
  COALESCE(ai_extracted, 0),
  created_at
FROM companies
WHERE name IS NOT NULL;
