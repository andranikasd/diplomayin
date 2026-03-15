-- Armenian OSINT Analytics — D1 (SQLite) Schema
-- Run: wrangler d1 execute armdata-db --file migrations/0001_schema.sql --remote

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'user',
    is_active INTEGER DEFAULT 1,
    last_login_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_am TEXT,
    industry TEXT,
    description TEXT,
    website TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'Armenia',
    registration_number TEXT,
    tax_id TEXT,
    founded_date DATE,
    employee_count INTEGER,
    revenue_estimate REAL,
    source TEXT,
    source_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    first_name TEXT,
    last_name TEXT,
    position TEXT,
    email TEXT,
    phone TEXT,
    linkedin_url TEXT,
    facebook_url TEXT,
    source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    profile_url TEXT,
    followers_count INTEGER,
    following_count INTEGER,
    posts_count INTEGER,
    engagement_rate REAL,
    avg_likes INTEGER,
    avg_comments INTEGER,
    avg_shares INTEGER,
    snapshot_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS news_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    title_am TEXT,
    content TEXT,
    summary TEXT,
    author TEXT,
    source TEXT NOT NULL,
    source_url TEXT UNIQUE,
    published_date DATETIME,
    category TEXT,
    sentiment TEXT DEFAULT 'neutral',
    language TEXT DEFAULT 'en',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS news_companies (
    news_id INTEGER REFERENCES news_articles(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    PRIMARY KEY (news_id, company_id)
);

CREATE TABLE IF NOT EXISTS statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    indicator TEXT NOT NULL,
    value REAL,
    unit TEXT,
    period TEXT,
    source TEXT NOT NULL,
    source_url TEXT,
    region TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS market_trends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    industry TEXT NOT NULL,
    trend_name TEXT NOT NULL,
    description TEXT,
    trend_score REAL,
    start_date DATE,
    end_date DATE,
    source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scraper_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_type TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT,
    status TEXT DEFAULT 'pending',
    items_scraped INTEGER DEFAULT 0,
    error_message TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_message TEXT NOT NULL,
    generated_sql TEXT,
    sql_error TEXT,
    result_count INTEGER,
    assistant_response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);
CREATE INDEX IF NOT EXISTS idx_news_published ON news_articles(published_date);
CREATE INDEX IF NOT EXISTS idx_news_source ON news_articles(source);
CREATE INDEX IF NOT EXISTS idx_news_url ON news_articles(source_url);
CREATE INDEX IF NOT EXISTS idx_statistics_category ON statistics(category);
CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_scraper_status ON scraper_jobs(status);
