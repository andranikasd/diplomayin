# Intelligent Query System - How It Works

## Overview

Your Armenian OSINT Analytics platform now has an **intelligent fallback system** that automatically searches for data when it's not in the database.

## 📊 The Workflow

When you ask a question like:
> "How many smokers in Armenia use Grani vs Ararat?"

Here's what happens:

### Step 1: Try Database First
```
User Query → AI generates SQL → Execute SQL → Check results
```

### Step 2: If Empty Results → Trigger Scraper
```
No results found
↓
Analyze query intent (what type of data? from which source?)
↓
Trigger scraper job (statistics/news/company)
↓
Wait for scraper to complete (max 30 seconds)
↓
If scraper finds data → Re-run original SQL query
↓
Return results to user
```

### Step 3: If Scraper Fails → Use AI Web Search
```
Scraper failed or no relevant source
↓
Ask LLM to search for the information
↓
LLM returns structured data (JSON)
↓
Store data in database
↓
Return results to user
```

### Step 4: If Nothing Works
```
Return friendly message: "No data found in database or external sources"
```

## 🔄 Complete Flow Diagram

```
┌─────────────┐
│ User Query  │
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│ Generate SQL (AI)│
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Execute Query   │
└──────┬───────────┘
       │
       ▼
   ┌───────┐
   │Results│
   │ > 0?  │
   └───┬───┘
       │
   ┌───┴───┐
   │ YES   │ NO
   │       │
   ▼       ▼
┌──────┐  ┌────────────────┐
│Return│  │ Analyze Intent │
│Data  │  │ Trigger Scraper│
└──────┘  └───────┬────────┘
                  │
                  ▼
          ┌───────────────┐
          │Scraper Success?│
          └───────┬────────┘
                  │
              ┌───┴───┐
              │YES│ NO│
              │   │   │
              ▼   ▼   │
         ┌────┐  ┌────┴─────────┐
         │Re- │  │ AI Web Search│
         │run │  └──────┬───────┘
         │SQL │         │
         └─┬──┘         │
           │            ▼
           │     ┌─────────────┐
           │     │Found Data?  │
           │     └──────┬──────┘
           │            │
           │        ┌───┴───┐
           │        │YES│ NO│
           │        │   │   │
           │        ▼   ▼   ▼
           │    ┌────┐ ┌─────────┐
           └───▶│Store│ │Return   │
                │& Use│ │"No Data"│
                └─┬──┘ └─────────┘
                  │
                  ▼
              ┌────────┐
              │ Return │
              │  Data  │
              └────────┘
```

## 💡 Example Queries

### Query 1: "Count of women under 25 in Gyumri"

1. ✅ **AI generates SQL**: 
   ```sql
   SELECT COUNT(*) FROM statistics 
   WHERE category = 'demographics' 
   AND indicator LIKE '%women%25%' 
   AND region = 'Gyumri';
   ```

2. ❌ **No results** → Triggers scraper

3. 🔍 **Scraper**: Looks for demographics data from armstat.am

4. ✅ **If found**: Stores in database, re-runs query, returns result

5. ❌ **If not found**: AI searches web for the information

6. 💾 **Stores** any found data for future queries

### Query 2: "How many smokers use Grani vs Ararat?"

1. ✅ **AI generates SQL**: 
   ```sql
   SELECT brand, COUNT(*) as smoker_count 
   FROM statistics 
   WHERE category = 'consumer' 
   AND indicator LIKE '%cigarette%brand%'
   GROUP BY brand;
   ```

2. ❌ **No results** → Scraper triggered

3. 🔍 **Scraper**: Tries to find consumer statistics

4. ❌ **Not found** → AI web search activated

5. 🤖 **AI**: Searches for Armenian cigarette brand market share data

6. ✅ **Returns**: Structured data or "Data not found"

## 🎯 Key Features

### 1. Automatic Intent Detection
The system analyzes your question to determine:
- **Type of data**: statistics, news, companies, etc.
- **Source**: armstat.am, news.am, business registry, etc.
- **Keywords**: Important terms to search for

### 2. Scraper Integration
- Creates scraper jobs in the queue
- Monitors job completion (30-second timeout)
- Automatically re-runs queries after data is found

### 3. AI Web Search
- Uses your LLM (OpenAI) to search for information
- Asks AI to return structured JSON data
- Automatically stores found data in the appropriate table

### 4. Data Persistence
- All AI-found data is stored in the database
- Future queries can use this data
- Builds up your intelligence database over time

## 📋 API Response Format

When using fallback, you'll see:

```json
{
  "success": true,
  "message": "Count of women under 25 in Gyumri",
  "sql": "SELECT COUNT(*) FROM ...",
  "results": [...],
  "resultCount": 1,
  "fallbackUsed": "ai-search",
  "fallbackInfo": {
    "source": "ai-search",
    "provider": "openai"
  }
}
```

### Fallback Types:
- `null` - Data found in database (no fallback needed)
- `"scraper"` - Data found by scraper
- `"ai-search"` - Data found by AI web search

## ⚙️ Configuration

In your `.env` file:

```env
# Must be enabled for the fallback system to work
ENABLE_AI_SQL=true
OPENAI_API_KEY=sk-your-key-here

# Optional: Scraper API URL (if running separately)
SCRAPER_API_URL=http://scraper:3001
```

## 🛠️ How to Use

Just ask your questions normally! The system handles everything automatically:

```javascript
// Example in the UI
"How many IT companies are in Yerevan?"
// → Tries DB → If empty, scrapes data → Returns results

"What's the GDP growth rate for 2024?"
// → Tries DB → If empty, gets from armstat.am → Returns results

"Latest news about Armenian startups"
// → Tries DB → If empty, scrapes news sources → Returns results
```

## 📊 Success Indicators

Watch for these in the UI:

- 🟢 **No badge**: Data from database
- 🔵 **"via scraper"**: Data was scraped
- 🟣 **"via AI search"**: Data found by AI

## 🚨 Limitations

1. **Scraper API**: Currently a placeholder - needs implementation in scraper service
2. **Timeout**: Scraper jobs timeout after 30 seconds
3. **AI Search**: Depends on LLM's ability to find and structure data
4. **Storage**: AI-found data stored generically (may need manual categorization)

## 🔮 Future Enhancements

- [ ] Implement REST API in scraper service for job triggering
- [ ] Add webhooks for async scraper completion
- [ ] Improve data classification and storage
- [ ] Add confidence scores for AI-found data
- [ ] Cache frequently requested data
- [ ] Rate limiting for external searches

## 📝 Testing

Try these queries to test the system:

```
1. "Show all companies" 
   → Should work immediately (sample data exists)

2. "Top 10 companies" by revenue"
   → Should work immediately

3. "How many smokers use Marlboro in Yerevan?"
   → Will trigger fallback (no data exists)

4. "What's the population of Gyumri?"
   → May find from sample data or trigger fallback
```

---

**Your application is now intelligent and self-improving!** 🧠✨
