-- Prevent duplicate statistics rows from repeated scraper runs
CREATE UNIQUE INDEX IF NOT EXISTS idx_statistics_unique
    ON statistics(indicator, period, source);
