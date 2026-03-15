# Setup Guide - Docker + Ollama Testing

This guide will help you test the Armenian OSINT Analytics platform using Docker Compose with Ollama (local LLM, no API keys required).

## 🎯 Quick Setup (Automated)

The fastest way to get started:

```bash
# Make setup script executable
chmod +x setup-ollama.sh

# Run the setup
./setup-ollama.sh
```

This script will:
1. ✅ Check Docker is running
2. 🚀 Start all services (PostgreSQL, Redis, Ollama, App, Scraper)
3. ⏳ Wait for services to be healthy
4. 📥 Pull the Llama2 model for Ollama
5. 🎉 Provide access URLs

After completion, visit: **http://localhost:3000**

---

## 🔧 Manual Setup

If you prefer to set up manually:

### 1. Start Services

```bash
docker-compose up -d
```

This starts:
- **PostgreSQL** (database)
- **Redis** (job queue)
- **Ollama** (local LLM)
- **App** (main application)
- **Scraper** (data collection worker)

### 2. Wait for Services

```bash
# Check status
docker-compose ps

# All services should show "healthy" or "running"
```

### 3. Pull Ollama Model

```bash
# Pull Llama2 (recommended for testing)
docker exec armenian-osint-ollama ollama pull llama2

# Or try a smaller model for faster testing
docker exec armenian-osint-ollama ollama pull llama2:7b

# Or use Mistral
docker exec armenian-osint-ollama ollama pull mistral
```

### 4. Initialize Database (if needed)

The database schema is automatically loaded on first startup. If you need to manually run migrations:

```bash
docker exec armenian-osint-app npm run db:migrate
```

### 5. Access the Application

Open your browser to: **http://localhost:3000**

---

## 🧪 Testing the Application

### Test 1: Chat Interface

1. Go to http://localhost:3000
2. You should see the chat interface with example queries
3. Try an example query:
   - "Show me top 10 companies by revenue"
   - "Get latest news about technology sector"

### Test 2: Natural Language to SQL

Type a question in natural language:
```
Show me all companies in the IT industry
```

The app will:
1. 🤖 Convert to SQL using Ollama
2. 📊 Execute the query
3. 📈 Display results (table + charts if applicable)

### Test 3: Dashboard

1. Click "Dashboard" in the navigation
2. View statistics and charts
3. Check recent activity

### Test 4: Health Check

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-01T...",
  "database": "connected"
}
```

---

## 📊 Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Web App** | http://localhost:3000 | Main application UI |
| **API** | http://localhost:3000/api | REST API endpoints |
| **PostgreSQL** | localhost:5432 | Database (use any SQL client) |
| **Redis** | localhost:6379 | Job queue |
| **Ollama** | http://localhost:11434 | Local LLM API |

---

## 🔍 Viewing Logs

### All services
```bash
docker-compose logs -f
```

### Specific service
```bash
docker-compose logs -f app        # Main application
docker-compose logs -f scraper    # Scraper worker
docker-compose logs -f ollama     # Ollama LLM
docker-compose logs -f postgres   # Database
```

---

## 🐛 Troubleshooting

### Issue: Ollama not responding

**Solution:**
```bash
# Restart Ollama
docker-compose restart ollama

# Check if model is loaded
docker exec armenian-osint-ollama ollama list

# Pull model again if needed
docker exec armenian-osint-ollama ollama pull llama2
```

### Issue: Database connection failed

**Solution:**
```bash
# Check if PostgreSQL is healthy
docker-compose ps postgres

# Restart database
docker-compose restart postgres

# View database logs
docker-compose logs postgres
```

### Issue: App shows "DB Disconnected"

**Solution:**
```bash
# Run migrations
docker exec armenian-osint-app npm run db:migrate

# Check database connection
docker exec armenian-osint-app node -e "require('./src/database/connection').healthCheck().then(r => console.log('DB:', r))"
```

### Issue: Slow LLM responses

**Possible causes:**
1. Ollama is downloading the model (check logs)
2. Model is too large for your system
3. First query is slower (model loading)

**Solutions:**
- Use a smaller model: `ollama pull llama2:7b`
- Check Ollama logs: `docker-compose logs ollama`
- Wait for model download to complete

### Issue: Port already in use

**Solution:**
```bash
# Check what's using the port
lsof -i :3000

# Stop conflicting service or change port in .env
PORT=3001
```

---

## 🧹 Cleanup

### Stop all services
```bash
docker-compose down
```

### Stop and remove volumes (deletes all data)
```bash
docker-compose down -v
```

### Remove everything including images
```bash
docker-compose down -v --rmi all
```

---

## 🔄 Updating Configuration

### Change LLM Model

Edit `docker-compose.yml` or pull a different model:

```bash
# Available models
docker exec armenian-osint-ollama ollama list

# Pull new model
docker exec armenian-osint-ollama ollama pull codellama
```

Then update `.env`:
```env
DEFAULT_LLM_PROVIDER=ollama
OLLAMA_MODEL=codellama
```

### Switch to OpenAI/Anthropic

Edit `.env`:
```env
DEFAULT_LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
```

Restart app:
```bash
docker-compose restart app
```

---

## 📝 Inserting Test Data

To test with sample data:

```bash
# Connect to PostgreSQL
docker exec -it armenian-osint-db psql -U postgres -d armenian_osint

# Insert test company
INSERT INTO companies (name, industry, revenue_estimate, employee_count) 
VALUES ('Test Tech Company', 'Technology', 1000000, 50);

# Insert test statistic
INSERT INTO statistics (category, indicator, value, period, source) 
VALUES ('economy', 'GDP Growth', 5.2, '2024', 'test');
```

Or use the scraper to collect real data (when sources are configured).

---

## 🎓 Next Steps

1. ✅ Verify all services are running
2. 🧪 Test basic queries in the chat interface
3. 📊 Check the dashboard
4. 🔧 Customize scraper sources in `scraper/src/scrapers/armenia-sources.js`
5. 🚀 Add real Armenian OSINT sources
6. 📈 Start collecting real data

---

## 📞 Support

If you encounter issues:

1. Check service health: `docker-compose ps`
2. View logs: `docker-compose logs -f`
3. Restart services: `docker-compose restart`
4. Full reset: `docker-compose down -v && docker-compose up -d`

For more details, see the main [README.md](README.md)
