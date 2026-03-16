-- Migration 0010: Expand statistics unique index to include region
-- The original index on (indicator, period, source) blocks multi-region data
-- (e.g. Yerevan 2022 and Aragatsotn 2022 share same indicator/period/source)
-- Drop and recreate with region included.

DROP INDEX IF EXISTS idx_statistics_unique;

CREATE UNIQUE INDEX idx_statistics_unique_regional
    ON statistics(indicator, period, source, region);
