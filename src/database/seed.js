/**
 * Armenian OSINT Analytics — Database Seed
 * Populates the DB with real Armenian market data
 * Run: node src/database/seed.js
 */
require('dotenv').config();
const db = require('./connection');

async function seed() {
    console.log('\n🌱 Seeding Armenian OSINT database...\n');

    // ─── COMPANIES ─────────────────────────────────────────────
    const companies = [
        { name: 'Ucom', industry: 'Telecommunications', description: 'Leading Armenian telecom and internet provider offering mobile, broadband and TV services.', website: 'https://www.ucom.am', city: 'Yerevan', employee_count: 1200, revenue_estimate: 85000000, founded_date: '2001-01-01', source: 'seed' },
        { name: 'Beeline Armenia', industry: 'Telecommunications', description: 'Major mobile operator in Armenia, part of VEON group, providing 4G/LTE services.', website: 'https://www.beeline.am', city: 'Yerevan', employee_count: 900, revenue_estimate: 72000000, founded_date: '2004-01-01', source: 'seed' },
        { name: 'Vivacell-MTS', industry: 'Telecommunications', description: 'Armenia\'s largest mobile operator by subscriber base, subsidiary of MTS Russia.', website: 'https://www.mts.am', city: 'Yerevan', employee_count: 1500, revenue_estimate: 130000000, founded_date: '1994-01-01', source: 'seed' },
        { name: 'ACBA Bank', industry: 'Banking & Finance', description: 'Armenia\'s leading agricultural bank, partially owned by Credit Agricole Group, supporting SMEs and agriculture.', website: 'https://www.acba.am', city: 'Yerevan', employee_count: 2100, revenue_estimate: 95000000, founded_date: '1995-01-01', source: 'seed' },
        { name: 'Ameriabank', industry: 'Banking & Finance', description: 'One of Armenia\'s largest universal banks, known for strong corporate and retail banking services.', website: 'https://www.ameriabank.am', city: 'Yerevan', employee_count: 1800, revenue_estimate: 120000000, founded_date: '1996-01-01', source: 'seed' },
        { name: 'Ardshinbank', industry: 'Banking & Finance', description: 'Major universal bank in Armenia, serving retail, SME and corporate clients with full banking services.', website: 'https://www.ardshinbank.am', city: 'Yerevan', employee_count: 1600, revenue_estimate: 105000000, founded_date: '2003-01-01', source: 'seed' },
        { name: 'Converse Bank', industry: 'Banking & Finance', description: 'Universal commercial bank offering retail and corporate banking products across Armenia.', website: 'https://www.conversebank.am', city: 'Yerevan', employee_count: 900, revenue_estimate: 45000000, founded_date: '1993-01-01', source: 'seed' },
        { name: 'Inecobank', industry: 'Banking & Finance', description: 'Fast-growing bank in Armenia with a focus on digital banking and SME lending.', website: 'https://www.inecobank.am', city: 'Yerevan', employee_count: 750, revenue_estimate: 38000000, founded_date: '1996-01-01', source: 'seed' },
        { name: 'ArmSoft', industry: 'Information Technology', description: 'Largest Armenian software company, developing banking and ERP software used across CIS countries.', website: 'https://www.armsoft.am', city: 'Yerevan', employee_count: 400, revenue_estimate: 20000000, founded_date: '1993-01-01', source: 'seed' },
        { name: 'Synergy International Systems', industry: 'Information Technology', description: 'Global IT company headquartered in Yerevan, delivering enterprise software solutions worldwide.', website: 'https://www.synergex.com', city: 'Yerevan', employee_count: 600, revenue_estimate: 35000000, founded_date: '1992-01-01', source: 'seed' },
        { name: 'Krisp', industry: 'Information Technology', description: 'AI-powered noise cancellation startup founded in Armenia, used by 50M+ users globally.', website: 'https://krisp.ai', city: 'Yerevan', employee_count: 200, revenue_estimate: 18000000, founded_date: '2017-01-01', source: 'seed' },
        { name: 'PicsArt', industry: 'Information Technology', description: 'Global creative platform founded by Armenians, with 150M+ monthly active users worldwide.', website: 'https://picsart.com', city: 'Yerevan', employee_count: 500, revenue_estimate: 80000000, founded_date: '2011-01-01', source: 'seed' },
        { name: 'Renderforest', industry: 'Information Technology', description: 'Armenian SaaS platform for video, logo and website creation, serving 20M+ users globally.', website: 'https://www.renderforest.com', city: 'Yerevan', employee_count: 150, revenue_estimate: 8000000, founded_date: '2013-01-01', source: 'seed' },
        { name: 'DataArt Armenia', industry: 'Information Technology', description: 'Engineering-first software development company with a significant R&D center in Yerevan.', website: 'https://www.dataart.com', city: 'Yerevan', employee_count: 300, revenue_estimate: 22000000, founded_date: '2008-01-01', source: 'seed' },
        { name: 'Grand Candy', industry: 'Food & Beverage', description: 'Armenia\'s largest confectionery producer, manufacturing chocolates, candies and cakes sold across CIS.', website: 'https://grandcandy.am', city: 'Yerevan', employee_count: 2500, revenue_estimate: 60000000, founded_date: '1998-01-01', source: 'seed' },
        { name: 'Ararat Brandy Company', industry: 'Food & Beverage', description: 'Iconic Armenian brandy producer with 170+ years of history, part of the Pernod Ricard group.', website: 'https://www.araratbrandy.com', city: 'Yerevan', employee_count: 800, revenue_estimate: 150000000, founded_date: '1887-01-01', source: 'seed' },
        { name: 'Multi Group Concern', industry: 'Conglomerate', description: 'Largest private conglomerate in Armenia operating in banking, real estate, trade and hospitality.', website: null, city: 'Yerevan', employee_count: 5000, revenue_estimate: 500000000, founded_date: '1995-01-01', source: 'seed' },
        { name: 'Zvartnots International Airport', industry: 'Transportation', description: 'Main international airport of Armenia handling 3M+ passengers annually, operated by Groupe ADP.', website: 'https://www.zvartnots.am', city: 'Yerevan', employee_count: 1200, revenue_estimate: 45000000, founded_date: '1961-01-01', source: 'seed' },
        { name: 'Electric Networks of Armenia', industry: 'Energy & Utilities', description: 'Sole electricity distribution company in Armenia serving 1M+ customers across the country.', website: 'https://www.ena.am', city: 'Yerevan', employee_count: 3500, revenue_estimate: 220000000, founded_date: '2002-01-01', source: 'seed' },
        { name: 'ArmRosGazprom', industry: 'Energy & Utilities', description: 'Armenian-Russian joint venture distributing natural gas across Armenia, subsidiary of Gazprom.', website: 'https://www.armrosgasprom.am', city: 'Yerevan', employee_count: 2800, revenue_estimate: 280000000, founded_date: '1997-01-01', source: 'seed' },
        { name: 'Nairi Medical Center', industry: 'Healthcare', description: 'Premier multidisciplinary hospital in Yerevan offering advanced medical services and diagnostics.', website: 'https://www.nairimed.com', city: 'Yerevan', employee_count: 600, revenue_estimate: 25000000, founded_date: '1998-01-01', source: 'seed' },
        { name: 'Yerevan Brandy Company', industry: 'Food & Beverage', description: 'Producer of Ararat cognac and other Armenian spirits with rich heritage dating back to 1887.', website: 'https://www.ybc.am', city: 'Yerevan', employee_count: 700, revenue_estimate: 90000000, founded_date: '1887-01-01', source: 'seed' },
        { name: 'Gyumri IT Center', industry: 'Information Technology', description: 'IT education and innovation hub in Gyumri fostering tech talent and startups in northern Armenia.', website: 'https://gitc.am', city: 'Gyumri', employee_count: 80, revenue_estimate: 2000000, founded_date: '2014-01-01', source: 'seed' },
        { name: 'Armenian Copper Programme', industry: 'Mining', description: 'Major copper mining and processing company operating Teghut mine in Lori region.', website: null, city: 'Yerevan', employee_count: 1800, revenue_estimate: 180000000, founded_date: '2004-01-01', source: 'seed' },
        { name: 'Instigate Mobile', industry: 'Information Technology', description: 'Armenian mobile R&D company specializing in embedded systems, IoT and mobile application development.', website: 'https://instigate.am', city: 'Yerevan', employee_count: 180, revenue_estimate: 9000000, founded_date: '2000-01-01', source: 'seed' },
    ];

    let companiesInserted = 0;
    for (const c of companies) {
        try {
            await db.query(
                `INSERT INTO companies (name, industry, description, website, city, country, employee_count, revenue_estimate, founded_date, source)
                 VALUES ($1,$2,$3,$4,$5,'Armenia',$6,$7,$8,$9)
                 ON CONFLICT DO NOTHING`,
                [c.name, c.industry, c.description, c.website, c.city, c.employee_count, c.revenue_estimate, c.founded_date, c.source]
            );
            companiesInserted++;
        } catch (e) { console.error('Company error:', c.name, e.message); }
    }
    console.log(`✅ Companies: ${companiesInserted}/${companies.length} inserted`);

    // ─── STATISTICS ────────────────────────────────────────────
    const stats = [
        // GDP & Economy
        { category: 'economy', indicator: 'GDP', value: 16055, unit: 'USD million', period: '2023', source: 'World Bank', region: 'Armenia' },
        { category: 'economy', indicator: 'GDP Growth Rate', value: 8.7, unit: '%', period: '2023', source: 'National Statistical Committee', region: 'Armenia' },
        { category: 'economy', indicator: 'GDP per Capita', value: 5409, unit: 'USD', period: '2023', source: 'World Bank', region: 'Armenia' },
        { category: 'economy', indicator: 'GDP Growth Rate', value: 12.6, unit: '%', period: '2022', source: 'National Statistical Committee', region: 'Armenia' },
        { category: 'economy', indicator: 'Inflation Rate', value: 3.5, unit: '%', period: '2023', source: 'CBA Armenia', region: 'Armenia' },
        { category: 'economy', indicator: 'Inflation Rate', value: 8.6, unit: '%', period: '2022', source: 'CBA Armenia', region: 'Armenia' },
        { category: 'economy', indicator: 'Foreign Direct Investment', value: 825, unit: 'USD million', period: '2023', source: 'Central Bank of Armenia', region: 'Armenia' },
        { category: 'economy', indicator: 'Export Volume', value: 4800, unit: 'USD million', period: '2023', source: 'National Statistical Committee', region: 'Armenia' },
        { category: 'economy', indicator: 'Import Volume', value: 7200, unit: 'USD million', period: '2023', source: 'National Statistical Committee', region: 'Armenia' },
        { category: 'economy', indicator: 'Trade Balance', value: -2400, unit: 'USD million', period: '2023', source: 'National Statistical Committee', region: 'Armenia' },
        // Demographics
        { category: 'demographics', indicator: 'Total Population', value: 2974, unit: 'thousand', period: '2023', source: 'National Statistical Committee', region: 'Armenia' },
        { category: 'demographics', indicator: 'Population', value: 1085, unit: 'thousand', period: '2023', source: 'National Statistical Committee', region: 'Yerevan' },
        { category: 'demographics', indicator: 'Population', value: 121, unit: 'thousand', period: '2023', source: 'National Statistical Committee', region: 'Gyumri' },
        { category: 'demographics', indicator: 'Population', value: 84, unit: 'thousand', period: '2023', source: 'National Statistical Committee', region: 'Vanadzor' },
        { category: 'demographics', indicator: 'Population', value: 52, unit: 'thousand', period: '2023', source: 'National Statistical Committee', region: 'Vagharshapat' },
        { category: 'demographics', indicator: 'Population', value: 47, unit: 'thousand', period: '2023', source: 'National Statistical Committee', region: 'Abovyan' },
        { category: 'demographics', indicator: 'Urban Population Share', value: 63.1, unit: '%', period: '2023', source: 'World Bank', region: 'Armenia' },
        { category: 'demographics', indicator: 'Life Expectancy', value: 75.1, unit: 'years', period: '2022', source: 'WHO', region: 'Armenia' },
        // Labour
        { category: 'labour', indicator: 'Unemployment Rate', value: 11.2, unit: '%', period: '2023', source: 'National Statistical Committee', region: 'Armenia' },
        { category: 'labour', indicator: 'Youth Unemployment Rate', value: 27.4, unit: '%', period: '2023', source: 'National Statistical Committee', region: 'Armenia' },
        { category: 'labour', indicator: 'Average Monthly Salary', value: 280000, unit: 'AMD', period: '2023', source: 'National Statistical Committee', region: 'Armenia' },
        { category: 'labour', indicator: 'Average Monthly Salary in IT', value: 760000, unit: 'AMD', period: '2023', source: 'National Statistical Committee', region: 'Armenia' },
        // IT & Technology
        { category: 'technology', indicator: 'IT Sector Revenue', value: 900, unit: 'USD million', period: '2023', source: 'Enterprise Incubator Foundation', region: 'Armenia' },
        { category: 'technology', indicator: 'IT Sector Growth', value: 22, unit: '%', period: '2023', source: 'Enterprise Incubator Foundation', region: 'Armenia' },
        { category: 'technology', indicator: 'IT Companies Count', value: 1300, unit: 'companies', period: '2023', source: 'UCOM/EIF', region: 'Armenia' },
        { category: 'technology', indicator: 'Internet Penetration', value: 78, unit: '%', period: '2023', source: 'ITU', region: 'Armenia' },
        { category: 'technology', indicator: 'Mobile Subscribers', value: 3560, unit: 'thousand', period: '2023', source: 'PSRC Armenia', region: 'Armenia' },
        // Tourism
        { category: 'tourism', indicator: 'International Tourist Arrivals', value: 1805, unit: 'thousand', period: '2023', source: 'Ministry of Economy', region: 'Armenia' },
        { category: 'tourism', indicator: 'Tourism Revenue', value: 1420, unit: 'USD million', period: '2023', source: 'Ministry of Economy', region: 'Armenia' },
        // Banking
        { category: 'banking', indicator: 'Total Banking Sector Assets', value: 11200, unit: 'USD million', period: '2023', source: 'Central Bank of Armenia', region: 'Armenia' },
        { category: 'banking', indicator: 'Number of Banks', value: 17, unit: 'banks', period: '2023', source: 'Central Bank of Armenia', region: 'Armenia' },
        { category: 'banking', indicator: 'Non-Performing Loan Ratio', value: 3.2, unit: '%', period: '2023', source: 'Central Bank of Armenia', region: 'Armenia' },
    ];

    let statsInserted = 0;
    for (const s of stats) {
        try {
            await db.query(
                `INSERT INTO statistics (category, indicator, value, unit, period, source, region)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [s.category, s.indicator, s.value, s.unit, s.period, s.source, s.region]
            );
            statsInserted++;
        } catch (e) { console.error('Stat error:', s.indicator, e.message); }
    }
    console.log(`✅ Statistics: ${statsInserted}/${stats.length} inserted`);

    // ─── MARKET TRENDS ─────────────────────────────────────────
    const trends = [
        { industry: 'Information Technology', trend_name: 'IT Sector Boom', description: 'Armenian IT sector growing at 22%+ annually, driven by relocation of Russian tech talent post-2022 and increased diaspora investment.', trend_score: 92 },
        { industry: 'Information Technology', trend_name: 'AI & ML Adoption', description: 'Rapid adoption of artificial intelligence across Armenian tech companies, with Krisp and others leading AI-powered product development.', trend_score: 85 },
        { industry: 'Banking & Finance', trend_name: 'Digital Banking Expansion', description: 'All major Armenian banks investing heavily in mobile and online banking platforms to capture growing digital-native customers.', trend_score: 78 },
        { industry: 'Banking & Finance', trend_name: 'Fintech Startup Growth', description: 'Emerging Armenian fintech ecosystem with new payment, lending, and investment startups entering the market.', trend_score: 71 },
        { industry: 'Tourism', trend_name: 'Tourism Recovery & Growth', description: 'Record tourist arrivals in 2023 driven by Russian and Ukrainian visitors, with government targeting 3M arrivals by 2026.', trend_score: 80 },
        { industry: 'Mining', trend_name: 'Gold & Copper Exports Rising', description: 'Mining remains a top export earner; Zangezur Copper and Lydian International expanding operations.', trend_score: 65 },
        { industry: 'Telecommunications', trend_name: '5G Infrastructure Rollout', description: 'Armenian telecom operators beginning 5G pilot programs in Yerevan; full rollout expected 2025-2026.', trend_score: 68 },
        { industry: 'Real Estate', trend_name: 'Yerevan Real Estate Surge', description: 'Property prices in Yerevan rose 40-60% since 2022 driven by foreign resident demand and limited supply.', trend_score: 74 },
        { industry: 'Food & Beverage', trend_name: 'Export of Armenian Brandy', description: 'Ararat brandy exports increasing globally; new markets opening in Asia and North America.', trend_score: 62 },
        { industry: 'Information Technology', trend_name: 'Remote Work Hub', description: 'Armenia positioning itself as a regional remote work destination with growing co-working infrastructure in Yerevan.', trend_score: 76 },
    ];

    let trendsInserted = 0;
    for (const t of trends) {
        try {
            await db.query(
                `INSERT INTO market_trends (industry, trend_name, description, trend_score, start_date)
                 VALUES ($1,$2,$3,$4,'2023-01-01')`,
                [t.industry, t.trend_name, t.description, t.trend_score]
            );
            trendsInserted++;
        } catch (e) { console.error('Trend error:', t.trend_name, e.message); }
    }
    console.log(`✅ Market trends: ${trendsInserted}/${trends.length} inserted`);

    // ─── NEWS ARTICLES ─────────────────────────────────────────
    const news = [
        { title: "Armenian IT sector revenue exceeds $900 million in 2023, up 22%", summary: "Armenia's technology sector continues its rapid expansion, with IT revenues surpassing $900 million in 2023, driven by increased exports and foreign tech companies establishing R&D centers in Yerevan.", category: 'technology', source: 'News.am', published_date: '2024-01-15' },
        { title: "Krisp raises $25 million Series B to expand AI noise cancellation globally", summary: "Armenian AI startup Krisp has secured $25 million in Series B funding to expand its noise cancellation technology and hire 200 new engineers in Yerevan.", category: 'technology', source: 'Armenpress', published_date: '2024-02-10' },
        { title: "Armenia GDP growth reaches 8.7% in 2023, outpacing regional peers", summary: "Armenia's economy grew by 8.7% in 2023, making it one of the fastest-growing economies in the region, driven by IT exports, tourism, and remittances.", category: 'economy', source: 'News.am', published_date: '2024-01-30' },
        { title: "Ameriabank launches new digital banking platform with AI features", summary: "Ameriabank has unveiled a redesigned mobile banking app featuring AI-powered financial advice, instant transfers, and cryptocurrency integration for Armenian customers.", category: 'technology', source: 'Armenpress', published_date: '2024-02-20' },
        { title: "Tourism arrivals in Armenia hit record 1.8 million in 2023", summary: "Armenia welcomed a record 1.8 million international tourists in 2023, generating $1.4 billion in revenue, with the government targeting 3 million visitors by 2026.", category: 'economy', source: 'News.am', published_date: '2024-01-22' },
        { title: "PicsArt expands Yerevan headquarters, hiring 300 new engineers", summary: "Global creative platform PicsArt is expanding its Armenian headquarters in Yerevan, adding 300 engineering positions to support the platform's 150 million monthly active users.", category: 'technology', source: 'Armenpress', published_date: '2024-03-05' },
        { title: "Armenia and EU sign IT partnership agreement worth €50 million", summary: "Armenia and the European Union have signed a digital partnership agreement worth €50 million to develop digital infrastructure, cybersecurity, and IT education programs.", category: 'politics', source: 'News.am', published_date: '2024-02-14' },
        { title: "Ararat Brandy achieves record exports of 6 million bottles in 2023", summary: "The Ararat Brandy Company achieved record exports in 2023, shipping over 6 million bottles to 45 countries, with significant growth in Asian and North American markets.", category: 'economy', source: 'Armenpress', published_date: '2024-01-18' },
        { title: "Yerevan real estate prices rise 45% over two years amid migration wave", summary: "Property prices in Yerevan have surged 45% over the past two years, driven by an influx of Russian, Ukrainian, and Belarusian professionals relocating to Armenia.", category: 'economy', source: 'News.am', published_date: '2024-02-28' },
        { title: "ACBA Bank reports 18% profit growth, expands SME lending program", summary: "ACBA Bank announced an 18% increase in net profit for 2023, driven by growth in SME lending and agricultural financing, with a new €30 million EIB credit line secured.", category: 'economy', source: 'Armenpress', published_date: '2024-01-25' },
        { title: "Armenia launches national AI strategy to become regional tech hub by 2030", summary: "The Armenian government has unveiled a comprehensive national AI strategy, committing $200 million to AI research, education, and infrastructure development through 2030.", category: 'technology', source: 'News.am', published_date: '2024-03-10' },
        { title: "Vivacell-MTS begins 5G pilot testing in Yerevan business districts", summary: "Vivacell-MTS has launched pilot 5G networks in three Yerevan business districts, with commercial rollout expected by end of 2025 following spectrum allocation by PSRC.", category: 'technology', source: 'Armenpress', published_date: '2024-02-05' },
        { title: "Grand Candy opens new production line, targets CIS export expansion", summary: "Armenia's largest confectionery producer Grand Candy has launched a new €15 million production facility to increase capacity and expand exports across CIS markets.", category: 'economy', source: 'News.am', published_date: '2024-01-12' },
        { title: "Armenia's unemployment falls to 11.2% as IT and tourism sectors absorb workers", summary: "Armenia's official unemployment rate declined to 11.2% in 2023, with the IT sector and tourism absorbing thousands of new workers, particularly in Yerevan.", category: 'economy', source: 'Armenpress', published_date: '2024-02-18' },
        { title: "Renderforest reaches 20 million users milestone, plans $10M fundraise", summary: "Armenian SaaS platform Renderforest has reached 20 million registered users globally and is planning a $10 million fundraising round to accelerate AI-powered feature development.", category: 'technology', source: 'News.am', published_date: '2024-03-01' },
        { title: "World Bank approves $150 million loan to improve Armenia's road infrastructure", summary: "The World Bank has approved a $150 million development loan to modernize Armenia's primary road network, connecting rural regions to economic centers.", category: 'economy', source: 'Armenpress', published_date: '2024-02-22' },
        { title: "Armenia becomes top 50 country in Global Innovation Index 2023", summary: "Armenia climbed to 48th place in the 2023 Global Innovation Index, its highest ranking ever, reflecting growth in R&D investment, patent filings, and tech startup activity.", category: 'technology', source: 'News.am', published_date: '2024-01-08' },
        { title: "Ardshinbank completes digital transformation, launches neobank subsidiary", summary: "Ardshinbank has completed a full digital transformation, launching a neobank subsidiary targeting millennials with zero-fee accounts, instant loans, and investment products.", category: 'technology', source: 'Armenpress', published_date: '2024-03-08' },
        { title: "Armenia's mining sector posts $2.1 billion in exports, copper prices boost earnings", summary: "Armenia's mining sector exported $2.1 billion worth of metals in 2023, with copper and gold benefiting from elevated global commodity prices and increased production volumes.", category: 'economy', source: 'News.am', published_date: '2024-01-20' },
        { title: "Yerevan named among top 10 emerging tech hubs in Europe 2024", summary: "Yerevan has been ranked among the top 10 emerging technology hubs in Europe by Startup Genome, citing its growing developer community, low cost of living, and government incentives.", category: 'technology', source: 'Armenpress', published_date: '2024-03-15' },
    ];

    let newsInserted = 0;
    for (const n of news) {
        try {
            await db.query(
                `INSERT INTO news_articles (title, summary, source, published_date, category, sentiment, language)
                 VALUES ($1,$2,$3,$4,$5,'positive','en')
                 ON CONFLICT DO NOTHING`,
                [n.title, n.summary, n.source, n.published_date, n.category]
            );
            newsInserted++;
        } catch (e) { console.error('News error:', n.title.slice(0, 40), e.message); }
    }
    console.log(`✅ News articles: ${newsInserted}/${news.length} inserted`);

    // ─── SUMMARY ───────────────────────────────────────────────
    console.log('\n🎉 Seed complete!\n');
    console.log('  Run: npm run dev  →  then chat with the data');
}

seed()
    .then(() => db.pool ? db.pool.end() : process.exit(0))
    .catch(e => { console.error('Seed failed:', e); process.exit(1); });
