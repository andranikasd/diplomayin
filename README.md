# Armenian OSINT Analytics Platform

A professional, SaaS-like chatbot application for analyzing Armenian open source intelligence data for marketing purposes. The platform features natural language to SQL conversion, real-time data visualization, and automated data scraping capabilities.

![Armenian OSINT Analytics](https://img.shields.io/badge/Status-Production%20Ready-green) ![Node.js](https://img.shields.io/badge/Node.js-v18+-blue) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue)

## 🌟 Features

- **💬 Intelligent Chatbot Interface**: Ask questions in natural language (English or Armenian)
- **🔄 Multi-LLM Support**: Flexible AI provider selection (OpenAI, Anthropic Claude, Ollama)
- **📊 Automatic SQL Generation**: Converts natural language to safe, optimized SQL queries
- **📈 Data Visualization**: Auto-generates charts and graphs from query results
- **🔍 OSINT Data Collection**: Automated scraping from Armenian sources
- **🎨 Professional SaaS UI**: Modern dark theme with glassmorphism and smooth animations
- **🔒 Security First**: SQL injection prevention and query validation
- **⚡ Real-time Updates**: WebSocket support for live interactions
- **📦 Export Capabilities**: CSV and JSON export for query results
- **🤖 Scraper Microservice**: Separate worker for data collection with job queue

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Web Client    │────▶│  Express Server  │────▶│   PostgreSQL    │
│  (SPA/React)    │◀────│    (Node.js)     │◀────│    Database     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │   ▲
                               │   │
                               ▼   │
                        ┌──────────────┐
                        │  LLM Wrapper │
                        │ (Multi-AI)   │
                        └──────────────┘
                        
┌──────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Scraper Worker  │────▶│  Bull Queue  │────▶│     Redis       │
│  (Microservice)  │     │  (Jobs)      │     │   (Queue DB)    │
└──────────────────┘     └──────────────┘     └─────────────────┘
```

## 📋 Prerequisites

- **Node.js** 18+ (LTS recommended)
- **PostgreSQL** 14+
- **Redis** 6+ (for scraper service)
- **npm** or **yarn**

Optional:
- Docker & Docker Compose (for containerized setup)
- LLM API Keys (OpenAI, Anthropic, or local Ollama)

## 🚀 Quick Start

### 1. Clone and Install

```bash
# Navigate to project directory
cd /Users/andranik_grigroyan/andranikasd/tam

# Install main application dependencies
npm install

# Install scraper dependencies
cd scraper
npm install
cd ..
```

### 2. Database Setup

Create PostgreSQL database:

```bash
createdb armenian_osint
```

Configure environment:

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your settings
nano .env
```

Run migrations:

```bash
npm run db:migrate
```

### 3. Configure LLM Provider

Edit `.env` and add at least one LLM provider:

```env
# Option 1: OpenAI
OPENAI_API_KEY=sk-your-key-here
DEFAULT_LLM_PROVIDER=openai

# Option 2: Anthropic Claude
ANTHROPIC_API_KEY=your-key-here
DEFAULT_LLM_PROVIDER=anthropic

# Option 3: Local Ollama
OLLAMA_BASE_URL=http://localhost:11434
DEFAULT_LLM_PROVIDER=ollama
```

### 4. Start the Application

```bash
# Start main application
npm run dev

# In a separate terminal, start scraper (optional)
cd scraper
npm run dev
```

Visit http://localhost:3000 🎉

## 📁 Project Structure

```
/Users/andranik_grigroyan/andranikasd/tam/
├── server.js                 # Main Express server
├── package.json             # Project dependencies
├── .env.example             # Environment template
├── src/
│   ├── database/
│   │   ├── connection.js    # PostgreSQL connection pool
│   │   ├── schema.sql       # Database schema
│   │   └── migrate.js       # Migration script
│   ├── services/
│   │   ├── llm-wrapper.js   # Multi-LLM integration
│   │   └── nlp-to-sql.js    # Natural language to SQL
│   └── routes/
│       ├── chat.js          # Chat API endpoints
│       └── data.js          # Data API endpoints
├── public/
│   ├── index.html           # Main HTML
│   ├── css/
│   │   └── styles.css       # Professional SaaS styles
│   └── js/
│       ├── app.js           # Main application logic
│       └── components/
│           ├── chat.js      # Chat component
│           ├── results.js   # Results display
│           └── charts.js    # Chart visualization
└── scraper/                 # Scraper microservice
    ├── worker.js            # Main worker process
    ├── package.json         # Scraper dependencies
    └── src/
        ├── queue.js         # Bull queue config
        └── scrapers/
            ├── base.js      # Base scraper class
            └── armenia-sources.js  # Armenian sources
```

## 🎯 API Endpoints

### Chat API

- `POST /api/chat` - Process natural language query
  ```json
  {
    "message": "Show me top 10 companies by revenue",
    "sessionId": "optional-session-id"
  }
  ```

- `GET /api/chat/history/:sessionId` - Get chat history
- `GET /api/chat/sessions` - List all sessions

### Data API

- `GET /api/data/summary` - Dashboard statistics
- `GET /api/data/companies?industry=tech&limit=100` - Get companies
- `GET /api/data/statistics?category=economy` - Get statistics

### Health

- `GET /api/health` - Server health check

## 🗄️ Database Schema

The platform includes comprehensive tables for:

- **Companies**: Business information, contacts, industry data
- **Contacts**: People and their positions
- **Social Metrics**: Social media tracking (followers, engagement)
- **News Articles**: News content with sentiment analysis
- **Statistics**: Economic and demographic data
- **Market Trends**: Industry trend tracking
- **Scraper Jobs**: Scraping job tracking and status
- **Chat History**: Conversation logs

See `src/database/schema.sql` for full schema.

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_NAME` | Database name | armenian_osint |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `ANTHROPIC_API_KEY` | Anthropic API key | - |
| `DEFAULT_LLM_PROVIDER` | Default AI provider | openai |

## 🤖 Scraper Service

The scraper microservice runs independently and collects data from Armenian sources:

### Starting the Scraper

```bash
cd scraper
cp .env.example .env
# Configure Redis and database
npm run dev
```

### Adding Scraping Jobs

Jobs are automatically scheduled, or you can trigger manually via the queue system.

### Supported Sources

Currently includes scrapers for:
- Armenian Statistics (armstat.am)
- News sources (News.am, Armenpress)
- Business registries (placeholder for custom implementation)

## 🎨 UI Features

- **Dark Mode**: Professional dark theme with purple gradients
- **Glassmorphism**: Modern frosted glass effects
- **Smooth Animations**: Micro-interactions and transitions
- **Responsive Design**: Mobile, tablet, and desktop support
- **Real-time Chat**: WebSocket-powered messaging
- **Interactive Charts**: Chart.js visualizations
- **Export Options**: Download results as CSV or JSON

## 🔒 Security

- SQL injection prevention via parameterized queries
- Query validation (only SELECT statements allowed)
- Rate limiting on API endpoints
- Helmet.js security headers
- CORS configuration
- Input sanitization

## 📊 Example Queries

Try these natural language queries:

- "Show me top 10 companies by revenue"
- "Get latest news about technology sector"
- "List all companies in the IT industry"
- "Show GDP statistics by region"
- "Find companies with more than 100 employees"
- "Get social media metrics for tech companies"

## 🐳 Docker Deployment

```bash
docker-compose up -d
```

See `docker-compose.yml` for configuration.

## 🧪 Development

```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Run database migrations
npm run db:migrate
```

## 📝 License

ISC

## 🤝 Contributing

Contributions welcome! Please follow standard Git workflow.

## 📞 Support

For issues or questions, please create an issue in the repository.

---

**Built with ❤️ for Armenian OSINT Analytics**
