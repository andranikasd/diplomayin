-- Extended data tables for Armenian OSINT

-- Categorical / text facts about Armenia
CREATE TABLE IF NOT EXISTS facts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category    TEXT NOT NULL,   -- 'geography','demographics','government','economy','culture',...
    key         TEXT NOT NULL,   -- e.g. 'capital_city', 'official_language', 'ethnic_groups'
    value       TEXT NOT NULL,   -- human-readable value
    value_num   REAL,            -- optional numeric representation
    unit        TEXT,
    period      TEXT,            -- year or date the fact refers to
    source      TEXT,
    notes       TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_facts_key_period ON facts(key, period);
CREATE        INDEX IF NOT EXISTS idx_facts_category   ON facts(category);

-- Daily exchange rates (AMD base)
CREATE TABLE IF NOT EXISTS exchange_rates (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    base         TEXT NOT NULL DEFAULT 'AMD',
    target       TEXT NOT NULL,   -- 'USD','EUR','RUB','GBP','CNY',...
    rate         REAL NOT NULL,   -- how many AMD per 1 target unit
    date         DATE NOT NULL,
    source       TEXT DEFAULT 'CBA Armenia',
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_xrate_pair_date ON exchange_rates(base, target, date);
CREATE        INDEX IF NOT EXISTS idx_xrate_date      ON exchange_rates(date);
