-- Prevent duplicate companies from repeated seed runs
-- First deduplicate: keep the lowest id for each name
DELETE FROM companies
WHERE id NOT IN (
    SELECT MIN(id) FROM companies GROUP BY name
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
