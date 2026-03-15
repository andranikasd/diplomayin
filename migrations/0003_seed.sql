-- Armenian OSINT Analytics — Seed Data
-- Run locally: npx wrangler d1 execute armdata-db --local --file=migrations/0003_seed.sql
-- Run remote:  npx wrangler d1 execute armdata-db --remote --file=migrations/0003_seed.sql

-- ─────────────────────────────────────────────────────────────
-- COMPANIES (real Armenian companies, public data only)
-- ─────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO companies (name, industry, city, country, employee_count, revenue_estimate, website, description, founded_date) VALUES
-- Information Technology
('EPAM Systems Armenia',       'Information Technology', 'Yerevan', 'Armenia', 2500, 18000000, 'epam.com',          'Global software engineering and IT services company with one of its largest development centers in Armenia.',        '2006-01-01'),
('Synopsys Armenia',           'Information Technology', 'Yerevan', 'Armenia', 1800, 14000000, 'synopsys.com',      'Leading EDA software and silicon IP products. Armenia center focuses on chip design verification.',                 '2004-01-01'),
('PicsArt',                    'Information Technology', 'Yerevan', 'Armenia',  500, 85000000, 'picsart.com',       'AI-powered photo and video editing platform used by 150M+ monthly active users worldwide.',                     '2011-01-01'),
('Renderforest',               'Information Technology', 'Yerevan', 'Armenia',  180, 6000000,  'renderforest.com',  'Online branding platform for videos, logos, mockups and websites. Bootstrapped Armenian startup.',               '2013-01-01'),
('ServiceTitan',               'Information Technology', 'Yerevan', 'Armenia',  400, 120000000,'servicetitan.com',  'SaaS platform for home services businesses. Founded by Ara Mahdessian and Vahe Kuzoyan.',                      '2012-01-01'),
('DataArt Armenia',            'Information Technology', 'Yerevan', 'Armenia',  220, 4000000,  'dataart.com',       'Technology consulting and custom software development for global clients.',                                    '2008-01-01'),
('Instigate Mobile',           'Information Technology', 'Yerevan', 'Armenia',  110, 2200000,  'instigatemobile.com','Mobile application development specializing in iOS and Android platforms.',                                    '2009-01-01'),
('ArmSoft',                    'Information Technology', 'Yerevan', 'Armenia',  130, 2800000,  'armsoft.am',        'Leading Armenian ERP and accounting software provider for local businesses.',                                  '1996-01-01'),
('Cognaize',                   'Information Technology', 'Yerevan', 'Armenia',   90, 2000000,  'cognaize.com',      'AI-powered intelligent document understanding platform for financial services.',                               '2018-01-01'),
('Nairi Technologies',         'Information Technology', 'Yerevan', 'Armenia',   70, 1500000,  'nairitech.am',      'Software development company focused on fintech and e-government solutions.',                                 '2015-01-01'),
('Mentor Graphics Armenia',    'Information Technology', 'Yerevan', 'Armenia',  550, 9000000,  'mentor.com',        'Part of Siemens, specializing in electronic design automation software.',                                     '2000-01-01'),
('ViPipe',                     'Information Technology', 'Yerevan', 'Armenia',   60, 1200000,  'vipipe.com',        'Video streaming infrastructure and CDN solutions for media companies.',                                      '2016-01-01'),

-- Banking & Finance
('Ameriabank',                 'Banking & Finance',      'Yerevan', 'Armenia', 2200, 95000000, 'ameriabank.am',     'Largest bank in Armenia by assets, providing corporate and retail banking services.',                          '1910-01-01'),
('Ardshinbank',                'Banking & Finance',      'Yerevan', 'Armenia', 1600, 72000000, 'ardshinbank.am',    'Second largest Armenian bank, known for retail lending and mortgage products.',                               '2003-01-01'),
('ACBA Bank',                  'Banking & Finance',      'Yerevan', 'Armenia', 1300, 55000000, 'acba.am',           'Leading agricultural and commercial bank in Armenia, cooperative banking model.',                             '1995-01-01'),
('Evocabank',                  'Banking & Finance',      'Yerevan', 'Armenia',  850, 38000000, 'evocabank.am',      'Digital-first bank known for innovative products and tech-driven banking experience.',                        '1990-01-01'),
('IDBank',                     'Banking & Finance',      'Yerevan', 'Armenia',  650, 28000000, 'idbank.am',         'Universal bank offering digital banking products and instant card issuance.',                                  '1990-01-01'),
('Armeconombank',              'Banking & Finance',      'Yerevan', 'Armenia',  420, 18000000, 'aeb.am',            'Commercial bank focused on SME lending and trade finance across Armenia.',                                   '1998-01-01'),
('Ararat Bank',                'Banking & Finance',      'Yerevan', 'Armenia',  310, 12000000, 'araratbank.am',     'Regional bank with strong presence in secondary Armenian cities.',                                           '2001-01-01'),
('VTB Bank Armenia',           'Banking & Finance',      'Yerevan', 'Armenia', 1900, 80000000, 'vtb.am',            'Subsidiary of VTB Group, one of Russia''s largest state banks.',                                           '2004-01-01'),

-- Telecommunications
('VivaCell-MTS',               'Telecommunications',     'Yerevan', 'Armenia', 1600, 200000000,'mts.am',            'Largest mobile operator in Armenia, part of MTS Group. 3M+ subscribers.',                                    '2005-01-01'),
('Ucom',                       'Telecommunications',     'Yerevan', 'Armenia', 1300, 85000000, 'ucom.am',           'Second largest telecom operator providing mobile, broadband and cable TV.',                                  '2010-01-01'),
('Telecom Armenia',            'Telecommunications',     'Yerevan', 'Armenia', 2100, 120000000,'telecom.am',        'Fixed-line and internet service provider, formerly state-owned.',                                            '1991-01-01'),

-- Energy & Utilities
('Electric Networks of Armenia','Energy & Utilities',    'Yerevan', 'Armenia', 3600, 280000000,'ena.am',            'State-owned electricity distribution company supplying power to all of Armenia.',                             '2002-01-01'),
('ArmRusGazard',               'Energy & Utilities',     'Yerevan', 'Armenia', 1300, 150000000,'armrusgaz.am',      'Natural gas distribution company, joint venture with Gazprom.',                                             '2004-01-01'),
('ContourGlobal Hydro Cascade','Energy & Utilities',     'Yerevan', 'Armenia',  850, 110000000,'contourglobal.com', 'Operates a cascade of hydroelectric power plants on the Vorotan River.',                                    '2012-01-01'),

-- Food & Beverage
('Multi Group Concern',        'Food & Beverage',        'Yerevan', 'Armenia', 5200, 320000000,'multigroup.am',     'Armenia''s largest private conglomerate with food production, retail and real estate.',                       '2002-01-01'),
('ARARAT Brandy Company',      'Food & Beverage',        'Yerevan', 'Armenia', 1600, 95000000, 'yerevanbrandy.am',  'Producer of the iconic ARARAT brandy, owned by Pernod Ricard since 1998.',                                  '1887-01-01'),
('Noy Winery',                 'Food & Beverage',        'Yerevan', 'Armenia',  220, 12000000, 'noywine.am',        'Armenian wine and brandy producer with portfolio of premium products.',                                     '1998-01-01'),
('Grand Candy',                'Food & Beverage',        'Yerevan', 'Armenia', 1900, 65000000, 'grandcandy.am',     'Largest confectionery company in Armenia, producing chocolates and sweets.',                                 '1998-01-01'),
('SAS Supermarkets',           'Food & Beverage',        'Yerevan', 'Armenia', 2600, 180000000,'sas.am',            'Leading supermarket chain in Armenia with 40+ stores across the country.',                                  '1993-01-01'),
('Gyumri Brewery',             'Food & Beverage',        'Gyumri',  'Armenia',  280, 18000000, NULL,                'Armenia''s second-largest brewery, producing popular local beer brands.',                                    '1952-01-01'),

-- Mining
('Lydian Armenia',             'Mining',                 'Yerevan', 'Armenia',  650, 45000000, 'lydianinternational.com','Gold mining company developing the Amulsar gold mine in the Vayots Dzor region.',                        '2004-01-01'),
('Zangezur Copper-Molybdenum', 'Mining',                 'Kapan',   'Armenia', 3300, 220000000,'zcmc.am',           'Largest mining company in Armenia, extracting copper and molybdenum concentrates.',                          '1951-01-01'),
('Armenian Copper Programme',  'Mining',                 'Alaverdi', 'Armenia',2600, 140000000,'armeniancopper.com', 'Operates the Alaverdi copper smelter and several regional mines.',                                        '2004-01-01'),

-- Transportation
('Armenian Railways',          'Transportation',         'Yerevan', 'Armenia', 3900, 95000000, 'railways.am',       'State-run railway network operated by South Caucasus Railways, a Gazprom subsidiary.',                      '2008-01-01'),
('Zvartnots International Airport','Transportation',     'Yerevan', 'Armenia', 1300, 75000000, 'zvartnots-airport.am','Armenia''s main international airport handling 3M+ passengers annually.',                                  '1961-01-01'),
('Armenia Air Company',        'Transportation',         'Yerevan', 'Armenia',  380, 28000000, NULL,                'Regional airline providing charter and scheduled flights from Yerevan.',                                     '2013-01-01'),

-- Healthcare
('Nairi Medical Center',       'Healthcare',             'Yerevan', 'Armenia',  850, 22000000, 'nairimed.am',       'One of Armenia''s leading multi-specialty hospitals with modern diagnostics.',                              '1953-01-01'),
('Erebuni Medical Center',     'Healthcare',             'Yerevan', 'Armenia',  650, 16000000, 'erebunimed.am',     'Major clinical hospital with cardiology and neurosurgery centers of excellence.',                           '1971-01-01'),
('Izmirlian Medical Center',   'Healthcare',             'Yerevan', 'Armenia',  520, 14000000, 'izmirlian.am',      'Modern hospital with American-standard medical protocols and international patients.',                       '2002-01-01'),

-- Conglomerate
('Grand Holding',              'Conglomerate',           'Yerevan', 'Armenia', 8200, 450000000,'grandholding.am',   'Largest conglomerate in Armenia spanning retail, real estate, entertainment and media.',                      '1995-01-01'),
('Multi-Invest Group',         'Conglomerate',           'Yerevan', 'Armenia', 3100, 180000000, NULL,               'Diversified investment group with interests in banking, construction and FMCG.',                             '2000-01-01'),

-- Real Estate
('Cascade Complex',            'Real Estate',            'Yerevan', 'Armenia',  220, 35000000, 'cascadecomplex.am', 'Iconic cultural and commercial complex with restaurants, galleries and offices.',                            '2009-01-01'),
('Metric Development',         'Real Estate',            'Yerevan', 'Armenia',  160, 28000000, 'metric.am',         'Leading residential and commercial real estate developer in Yerevan.',                                      '2006-01-01'),
('Axis',                       'Real Estate',            'Yerevan', 'Armenia',  140, 22000000, 'axis.am',           'Real estate agency and property management company with 500+ listings.',                                   '2003-01-01');

-- ─────────────────────────────────────────────────────────────
-- NEWS ARTICLES
-- ─────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO news_articles (title, content, summary, source, published_date, category, sentiment, language) VALUES
('Armenia''s Tech Sector Reaches Record $400M in Exports',
 'Armenia''s information technology sector achieved record export revenues of approximately $400 million in the past fiscal year, according to official statistics. The growth was driven by companies such as EPAM Systems, Synopsys, and emerging startups in the AI and fintech space. The government''s Smart Armenia initiative continues to attract foreign investment.',
 'Armenia''s IT export revenues hit a record $400M, driven by EPAM, Synopsys and AI startups.',
 'Armenpress', '2024-03-15', 'economy', 'positive', 'en'),

('PicsArt Raises $130M Series D, Valuation Exceeds $1.5B',
 'Yerevan-founded PicsArt has raised $130 million in a Series D funding round, pushing its valuation beyond $1.5 billion and cementing its status as Armenia''s most valuable startup. The company plans to expand its AI-powered creative tools and increase its workforce in Armenia by 200 employees this year.',
 'PicsArt raises $130M Series D, valued at $1.5B+, plans to hire 200 more in Armenia.',
 'Tech.eu', '2024-02-20', 'technology', 'positive', 'en'),

('Ameriabank Reports 18% Profit Growth in 2023',
 'Ameriabank, Armenia''s largest bank by assets, reported an 18% increase in net profit for 2023, reaching AMD 42 billion ($110M). The growth was attributed to rising loan volumes, improved net interest margin and a surge in digital banking customers, which grew 35% year-over-year.',
 'Ameriabank net profit up 18% to AMD 42B in 2023 on digital banking growth.',
 'Banker.am', '2024-01-30', 'economy', 'positive', 'en'),

('VivaCell-MTS Launches 5G Pilot Network in Yerevan',
 'Armenia''s largest mobile operator VivaCell-MTS has launched a 5G pilot network in select districts of Yerevan, becoming the first telecom company in the South Caucasus to deploy fifth-generation mobile technology. Commercial 5G services are expected by Q4 2024.',
 'VivaCell-MTS deploys first 5G pilot in South Caucasus, commercial launch expected Q4 2024.',
 'News.am', '2024-03-01', 'technology', 'positive', 'en'),

('Armenia GDP Growth Slows to 5.2% in Q1 2024',
 'Armenia''s gross domestic product grew by 5.2% in the first quarter of 2024 compared to the same period last year, according to the National Statistical Service. While still positive, the growth rate represents a deceleration from the 12.6% recorded in 2022 and 8.7% in 2023. The slowdown is attributed to normalization following the extraordinary inflow of Russian migrants.',
 'Armenia GDP growth slows to 5.2% in Q1 2024 after extraordinary post-2022 surge.',
 'Armstat', '2024-04-10', 'economy', 'neutral', 'en'),

('Zangezur Copper Mine Increases Output by 12%',
 'Zangezur Copper-Molybdenum Combine (ZCMC), Armenia''s largest mining company, increased copper concentrate output by 12% in 2023, reaching 1.2 million tonnes processed. The company invested $85 million in modernizing its ore processing facilities and plans to expand operations into deeper ore deposits.',
 'ZCMC boosts copper output 12% to 1.2M tonnes, invests $85M in modernization.',
 'Mining.am', '2024-01-15', 'economy', 'positive', 'en'),

('Grand Candy Opens 5th Factory, Targets Export Markets',
 'Armenia''s leading confectionery producer Grand Candy has opened its fifth production facility in the Yerevan Free Economic Zone, adding capacity for 15,000 tonnes of chocolate products annually. The company aims to increase exports to EU markets following Armenia''s CEPA agreement with the European Union.',
 'Grand Candy opens new factory in Yerevan FEZ, targeting EU exports under CEPA.',
 'Armenpress', '2024-02-08', 'business', 'positive', 'en'),

('Electric Networks of Armenia Loses $45M to Electricity Theft',
 'Armenia''s electricity distribution company reported losses of approximately AMD 17 billion ($45 million) due to electricity theft and technical losses in 2023. The company is deploying 850,000 smart meters nationwide to reduce non-technical losses, with completion expected by 2026.',
 'ENA loses $45M to electricity theft; smart meter rollout to 850K homes underway.',
 'News.am', '2024-03-20', 'economy', 'negative', 'en'),

('Armenia Attracts Record $1.2B in FDI for 2023',
 'Foreign direct investment into Armenia reached a record $1.2 billion in 2023, more than double the pre-pandemic figure, according to the Central Bank of Armenia. Russia, UAE and France were the top sources of investment. The IT sector attracted the largest share at 28% of total FDI.',
 'Armenia FDI hits record $1.2B in 2023, IT sector leads with 28% share.',
 'CBA Armenia', '2024-01-22', 'economy', 'positive', 'en'),

('ARARAT Brandy Wins Double Gold at IWSC London',
 'The ARARAT Apricot brandy won Double Gold at the International Wine & Spirits Competition (IWSC) in London, adding to the brand''s growing international recognition. This is the fourth consecutive year that ARARAT products have received top honors at the prestigious competition.',
 'ARARAT Apricot brandy wins Double Gold at IWSC London for fourth consecutive year.',
 'Armenpress', '2023-11-14', 'business', 'positive', 'en'),

('ServiceTitan Valued at $9.5B After Secondary Share Sale',
 'Glendale-founded ServiceTitan, whose co-founders trace their roots to Armenia, saw its valuation hit $9.5 billion in a secondary share transaction. The company, which provides software for home service businesses, maintains a growing engineering team in Yerevan and is preparing for a potential IPO.',
 'ServiceTitan valuation reaches $9.5B; Yerevan engineering hub continues to expand.',
 'TechCrunch', '2024-01-10', 'technology', 'positive', 'en'),

('Armenia Inflation Falls to 1.5%, Lowest Since 2016',
 'Consumer price inflation in Armenia fell to 1.5% year-on-year in February 2024, the lowest reading since 2016. The Central Bank of Armenia has held its refinancing rate at 8% as it monitors disinflation trends. Food prices declined 0.8% while services rose 3.2%.',
 'Armenia inflation drops to 1.5%, 8-year low; CBA holds rates steady at 8%.',
 'CBA Armenia', '2024-03-05', 'economy', 'positive', 'en'),

('Lydian Armenia Halts Amulsar Gold Mine Development',
 'Canadian mining company Lydian Armenia announced it has suspended further development of the Amulsar gold mine following ongoing environmental protests and regulatory reviews. The mine, which contains estimated gold reserves of 2.6 million ounces, has been contested since 2018.',
 'Lydian Armenia suspends Amulsar gold mine amid persistent environmental protests.',
 'Hetq', '2024-02-14', 'environment', 'negative', 'en'),

('Yerevan Ranks Among Top 10 European Cities for Startup Growth',
 'Yerevan has been included in a European startup ecosystem report as one of the top 10 emerging cities for startup activity, driven by growth in the IT sector and an influx of international tech talent. The city has seen a 45% increase in registered tech companies since 2022.',
 'Yerevan enters top 10 European emerging startup cities, 45% growth in tech companies since 2022.',
 'Startup Genome', '2024-03-28', 'technology', 'positive', 'en'),

('ArmRusGazard Raises Gas Tariffs by 8% Effective April 2024',
 'ArmRusGazard, Armenia''s natural gas distributor, has announced an 8% increase in retail gas tariffs effective April 1, 2024. The increase was approved by the Public Services Regulatory Commission following a review of the company''s operational costs and gas procurement prices.',
 'ArmRusGazard increases gas tariffs 8% from April 2024 after PSRC approval.',
 'News.am', '2024-03-15', 'economy', 'negative', 'en'),

('Renderforest Reaches 20 Million Registered Users',
 'Yerevan-based Renderforest, the online branding and video creation platform, announced it has reached 20 million registered users across 180+ countries. The company, which bootstrapped its growth without external VC funding, is now exploring strategic partnerships for its AI-powered design tools.',
 'Renderforest hits 20M users in 180+ countries, eyes AI design tool partnerships.',
 'Forbes Armenia', '2024-02-29', 'technology', 'positive', 'en');

-- ─────────────────────────────────────────────────────────────
-- STATISTICS
-- ─────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, region, notes) VALUES
('Economy',       'GDP (Nominal)',              19.8,  'Billion USD', '2023',    'World Bank',  'Armenia',  'Nominal GDP at current prices'),
('Economy',       'GDP Growth Rate',             8.7,  'Percent',     '2023',    'Armstat',     'Armenia',  'Real GDP growth vs prior year'),
('Economy',       'GDP per Capita',             6650,  'USD',         '2023',    'World Bank',  'Armenia',  'GDP per capita at current prices'),
('Economy',       'Inflation Rate',              1.5,  'Percent',     'Feb 2024','CBA Armenia', 'Armenia',  'Year-on-year CPI change'),
('Economy',       'Unemployment Rate',           14.6, 'Percent',     '2023',    'Armstat',     'Armenia',  'Official ILO-method unemployment'),
('Economy',       'FDI Inflows',                 1.2,  'Billion USD', '2023',    'CBA Armenia', 'Armenia',  'Foreign direct investment record high'),
('Economy',       'Exports (Goods)',              3.1,  'Billion USD', '2023',    'Armstat',     'Armenia',  'Total goods export value'),
('Economy',       'Imports (Goods)',              6.2,  'Billion USD', '2023',    'Armstat',     'Armenia',  'Total goods import value'),
('Economy',       'Remittances',                 2.6,  'Billion USD', '2023',    'CBA Armenia', 'Armenia',  'Total personal remittances received'),
('Economy',       'Central Bank Rate',            8.0,  'Percent',     'Mar 2024','CBA Armenia', 'Armenia',  'CBA refinancing rate'),
('Demographics',  'Total Population',            2.97, 'Million',     '2023',    'Armstat',     'Armenia',  'Resident population estimate'),
('Demographics',  'Population Yerevan',          1.09, 'Million',     '2023',    'Armstat',     'Yerevan',  'Capital city population'),
('Demographics',  'Population Gyumri',           0.12, 'Million',     '2023',    'Armstat',     'Gyumri',   'Second largest city'),
('Demographics',  'Population Vanadzor',         0.09, 'Million',     '2023',    'Armstat',     'Vanadzor', 'Third largest city'),
('Demographics',  'Population Vagharshapat',     0.05, 'Million',     '2023',    'Armstat',     'Vagharshapat','Religious capital'),
('Demographics',  'Urban Population Share',      63.3, 'Percent',     '2023',    'World Bank',  'Armenia',  'Share of population in urban areas'),
('Demographics',  'Median Age',                  36.2, 'Years',       '2023',    'UN DESA',     'Armenia',  'Median age of population'),
('Technology',    'Internet Penetration',        78.6, 'Percent',     '2023',    'ITU',         'Armenia',  'Share of population with internet access'),
('Technology',    'Mobile Subscriptions',        3.5,  'Million',     '2023',    'ANCOM',       'Armenia',  'Active mobile subscriptions'),
('Technology',    'IT Export Revenue',            0.4,  'Billion USD', '2023',    'UITE',        'Armenia',  'IT sector export revenues record'),
('Technology',    'IT Companies Registered',    2850,  'Count',       '2023',    'State Registry','Armenia','Number of registered IT companies'),
('Technology',    'IT Workforce',               65000, 'Persons',     '2023',    'UITE',        'Armenia',  'Employed in IT sector'),
('Banking',       'Banking Sector Assets',       15.8, 'Billion USD', '2023',    'CBA Armenia', 'Armenia',  'Total assets of Armenian banking system'),
('Banking',       'Non-Performing Loans',         2.8, 'Percent',     '2023',    'CBA Armenia', 'Armenia',  'NPL ratio across banking system'),
('Banking',       'Number of Banks',             17,   'Count',       '2024',    'CBA Armenia', 'Armenia',  'Licensed commercial banks operating'),
('Energy',        'Electricity Production',      8.2,  'TWh',         '2023',    'PSRC',        'Armenia',  'Total electricity generated'),
('Energy',        'Hydropower Share',            32.4, 'Percent',     '2023',    'PSRC',        'Armenia',  'Share of hydro in electricity mix'),
('Energy',        'Nuclear Power Share',         35.8, 'Percent',     '2023',    'PSRC',        'Armenia',  'Metsamor NPP share of electricity'),
('Mining',        'Copper Export Value',          1.1,  'Billion USD', '2023',    'Armstat',     'Armenia',  'Value of copper concentrate exports'),
('Mining',        'Gold Production',             3500, 'Kg',          '2023',    'Armstat',     'Armenia',  'Total gold production');

-- ─────────────────────────────────────────────────────────────
-- MARKET TRENDS
-- ─────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO market_trends (industry, trend_name, description, trend_score, start_date, source) VALUES
('Information Technology', 'AI Startup Surge',         'Rapid growth of AI-focused startups in Yerevan, particularly in NLP and computer vision.',     88, '2023-01-01', 'UITE'),
('Information Technology', 'Diaspora Tech Return',     'Significant return of diaspora Armenians with Silicon Valley experience to found or join local companies.', 75, '2022-06-01', 'Startup.am'),
('Banking & Finance',       'Digital Banking Adoption', 'Accelerating shift to mobile banking apps, with digital transactions up 65% in 2023.',          82, '2022-01-01', 'CBA Armenia'),
('Banking & Finance',       'Crypto Asset Growth',      'Growing interest in cryptocurrency assets despite regulatory uncertainty.',                        60, '2021-01-01', 'CBA Armenia'),
('Telecommunications',      '5G Rollout',               'First 5G deployments in Yerevan with nationwide coverage planned for 2026.',                      70, '2024-01-01', 'ANCOM'),
('Energy & Utilities',      'Renewables Expansion',     'Strong investment in solar and wind energy driven by government incentives and donor funding.',    78, '2022-01-01', 'IRENA'),
('Mining',                  'Environmental Scrutiny',   'Increased regulatory and public pressure on mining operations near protected areas.',              65, '2019-01-01', 'EcoLur'),
('Food & Beverage',          'Premium Armenian Wine',    'Growing international recognition and export demand for Armenian wines.',                          72, '2020-01-01', 'WineArm'),
('Real Estate',             'Yerevan Property Boom',    'Surge in real estate prices and development activity driven by migration inflows since 2022.',     90, '2022-03-01', 'Armstat'),
('Conglomerate',            'Diversification Drive',    'Major holding groups expanding into new sectors including healthcare and fintech.',               68, '2023-01-01', 'Forbes AM');
