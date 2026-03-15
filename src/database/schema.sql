-- Armenian OSINT Marketing Intelligence Database Schema

-- Companies and Organizations
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    name_am VARCHAR(255), -- Armenian name
    industry VARCHAR(100),
    description TEXT,
    website VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Armenia',
    registration_number VARCHAR(100),
    tax_id VARCHAR(100),
    founded_date DATE,
    employee_count INTEGER,
    revenue_estimate DECIMAL(15, 2),
    source VARCHAR(255), -- Source of data
    source_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contacts and People
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies (id) ON DELETE SET NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    position VARCHAR(150),
    email VARCHAR(255),
    phone VARCHAR(50),
    linkedin_url VARCHAR(255),
    facebook_url VARCHAR(255),
    source VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Social Media Metrics
CREATE TABLE IF NOT EXISTS social_metrics (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies (id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- facebook, instagram, linkedin, twitter
    profile_url VARCHAR(255),
    followers_count INTEGER,
    following_count INTEGER,
    posts_count INTEGER,
    engagement_rate DECIMAL(5, 2),
    avg_likes INTEGER,
    avg_comments INTEGER,
    avg_shares INTEGER,
    snapshot_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- News and Articles
CREATE TABLE IF NOT EXISTS news_articles (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    title_am VARCHAR(500), -- Armenian title
    content TEXT,
    summary TEXT,
    author VARCHAR(255),
    source VARCHAR(255) NOT NULL,
    source_url TEXT,
    published_date TIMESTAMP,
    category VARCHAR(100),
    sentiment VARCHAR(20), -- positive, negative, neutral
    language VARCHAR(10) DEFAULT 'hy', -- hy for Armenian, en for English
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Link news articles to companies
CREATE TABLE IF NOT EXISTS news_companies (
    news_id INTEGER REFERENCES news_articles (id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies (id) ON DELETE CASCADE,
    PRIMARY KEY (news_id, company_id)
);

-- Statistical Data
CREATE TABLE IF NOT EXISTS statistics (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100) NOT NULL, -- economy, demographics, trade, etc.
    indicator VARCHAR(255) NOT NULL, -- GDP, population, unemployment rate, etc.
    value DECIMAL(20, 4),
    unit VARCHAR(50), -- percentage, USD, people, etc.
    period VARCHAR(50), -- 2023, Q1 2024, January 2024, etc.
    source VARCHAR(255) NOT NULL,
    source_url TEXT,
    region VARCHAR(100), -- Yerevan, Gyumri, etc.
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Market Trends
CREATE TABLE IF NOT EXISTS market_trends (
    id SERIAL PRIMARY KEY,
    industry VARCHAR(100) NOT NULL,
    trend_name VARCHAR(255) NOT NULL,
    description TEXT,
    trend_score DECIMAL(5, 2), -- 0-100 score
    start_date DATE,
    end_date DATE,
    source VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scraper Jobs
CREATE TABLE IF NOT EXISTS scraper_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(100) NOT NULL, -- company, news, statistics, social
    source_name VARCHAR(255) NOT NULL,
    source_url TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed
    items_scraped INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat History
CREATE TABLE IF NOT EXISTS chat_history (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    user_message TEXT NOT NULL,
    generated_sql TEXT,
    sql_error TEXT,
    result_count INTEGER,
    assistant_response TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies (name);

CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies (industry);

CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts (company_id);

CREATE INDEX IF NOT EXISTS idx_social_metrics_company ON social_metrics (company_id);

CREATE INDEX IF NOT EXISTS idx_social_metrics_platform ON social_metrics (platform);

CREATE INDEX IF NOT EXISTS idx_news_published ON news_articles (published_date);

CREATE INDEX IF NOT EXISTS idx_news_source ON news_articles (source);

CREATE INDEX IF NOT EXISTS idx_statistics_category ON statistics (category);

CREATE INDEX IF NOT EXISTS idx_statistics_period ON statistics (period);

CREATE INDEX IF NOT EXISTS idx_scraper_status ON scraper_jobs (status);

CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_history (session_id);

-- Create full-text search indexes
CREATE INDEX IF NOT EXISTS idx_companies_search ON companies USING gin (
    to_tsvector (
        'english',
        name || ' ' || COALESCE(description, '')
    )
);

CREATE INDEX IF NOT EXISTS idx_news_search ON news_articles USING gin (
    to_tsvector (
        'english',
        title || ' ' || COALESCE(content, '')
    )
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();