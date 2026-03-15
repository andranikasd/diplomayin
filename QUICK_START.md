# Quick Start Guide - No AI Required

This guide shows you how to run the Armenian OSINT Analytics platform **WITHOUT** AI/LLM dependencies. The app will use basic pattern matching for SQL generation.

## 🚀 Option 1: Quick Start (No AI - Pattern Matching)

### Prerequisites
- Docker & Docker Compose installed
- Nothing else needed!

### Steps

```bash
# Navigate to project directory
cd /Users/andranik_grigroyan/andranikasd/tam

# Start services
docker-compose up -d

# Wait ~30 seconds for services to start
docker-compose ps

# Access the app
open http://localhost:3000
```

That's it! The app will work with basic pattern matching for queries like:
- "Show all companies"
- "Top 10 companies by revenue"
- "Latest news"
- "Show statistics"
- "List contacts"

---

## 🤖 Option 2: Enable AI with OpenAI (Recommended)

If you want **real** natural language to SQL with any query, use OpenAI:

### Step 1: Get OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign up/login
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)

### Step 2: Configure

Edit `.env` file:

```bash
nano .env
```

Update these lines:

```env
# Enable AI
ENABLE_AI_SQL=true

# Add your OpenAI key
OPENAI_API_KEY=sk-your-actual-key-here
DEFAULT_LLM_PROVIDER=openai
```

### Step 3: Restart

```bash
docker-compose restart app
```

Now you can ask **any** question in natural language!

---

## 📊 Verify It's Working

### Check Services
```bash
docker-compose ps
```

All services should show "healthy" or "Up".

### Check API
```bash
curl http://localhost:3000/api/health
```

Should return:
```json
{
  "status": "healthy",
  "database": "connected"
}
```

### Test Query
Open http://localhost:3000 and try:
- **Without AI**: "Show all companies" or "Top 10 companies by revenue"
- **With AI**: Any question like "Which companies have more than 50 employees?"

---

## 📝 Adding Test Data

To see actual results, insert some test data:

```bash
# Connect to database
docker exec -it armenian-osint-db psql -U postgres -d armenian_osint

# Insert test companies
INSERT INTO companies (name, industry, revenue_estimate, employee_count, city) VALUES
('TechCorp Armenia', 'Technology', 5000000, 120, 'Yerevan'),
('FinanceHub', 'Finance', 3000000, 80, 'Yerevan'),
('EduSoft', 'Education', 1500000, 45, 'Gyumri'),
('HealthTech', 'Healthcare', 2000000, 60, 'Yerevan'),
('RetailPro', 'Retail', 800000, 30, 'Vanadzor');

# Insert test statistics
INSERT INTO statistics (category, indicator, value, period, source) VALUES
('economy', 'GDP Growth', 7.5, '2024', 'armstat.am'),
('economy', 'Unemployment Rate', 4.2, '2024', 'armstat.am'),
('demographics', 'Population', 2963000, '2024', 'armstat.am');

# Insert test news
INSERT INTO news_articles (title, summary, published_date, source, category) VALUES
('Tech Sector Grows 15% in Q1', 'Armenian technology sector shows strong growth...', '2024-03-15', 'News.am', 'Technology'),
('New Investments in Healthcare', 'Healthcare sector receives major investment...', '2024-03-10', 'Armenpress', 'Healthcare');

# Exit
\q
```

Now try queries:
- "Show all companies"
- "Top companies by revenue"
- "Latest news"

---

## 🔧 Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose logs

# Restart
docker-compose down
docker-compose up -d
```

### Database connection failed
```bash
# Restart PostgreSQL
docker-compose restart postgres

# Check if healthy
docker-compose ps postgres
```

### Can't access localhost:3000
```bash
# Check if port is in use
lsof -i :3000

# Or change port in .env
PORT=3001
```

---

## 🎯 What Works Without AI

Using pattern matching (no AI), these queries work:

| Query | SQL Generated |
|-------|---------------|
| "Show all companies" | Lists all companies |
| "Top 10 companies by revenue" | Top companies by revenue |
| "Top 5 companies by revenue" | Top 5 companies |
| "Companies in tech industry" | Tech companies |
| "Latest news" | Recent news articles |
| "Show statistics" | Statistical data |
| "Show contacts" | Contact list |
| "Social media followers" | Social metrics |

**Custom/complex queries require AI enabled!**

---

## 💰 OpenAI Costs

- **Model**: GPT-4-turbo
- **Cost**: ~$0.01 per query (very cheap!)
- **Free tier**: $5 credit for new accounts

For testing, $5 = ~500 queries.

---

## 📚 Next Steps

1. ✅ Start without AI to test the interface
2. 📊 Add test data to see results
3. 🎨 Explore the dashboard
4. 🤖 Enable OpenAI when ready for full NLP
5. 🔧 Customize scrapers for real data sources

---

## 🆘 Support

**Services won't start?**
```bash
docker-compose down -v  # Clean slate
docker-compose up -d    # Restart
```

**Need OpenAI help?**
- Create account: https://platform.openai.com
- API keys: https://platform.openai.com/api-keys
- Pricing: https://openai.com/pricing

**Want local/free AI?**
See `SETUP_GUIDE.md` for Ollama setup (runs locally, no API key).
