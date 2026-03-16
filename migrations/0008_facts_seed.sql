-- Static facts about Armenia (idempotent — INSERT OR IGNORE)

-- ── Geography ──────────────────────────────────────────────────────
INSERT OR IGNORE INTO facts (category, key, value, value_num, unit, period, source) VALUES
('geography', 'capital_city',        'Yerevan',                          NULL, NULL, NULL, 'CIA World Factbook'),
('geography', 'area_total_km2',      '29,743',                           29743, 'km²', NULL, 'CIA World Factbook'),
('geography', 'area_rank_world',     '141st largest country',            141, 'rank', NULL, 'CIA World Factbook'),
('geography', 'bordering_countries', 'Turkey, Georgia, Azerbaijan, Iran',NULL, NULL, NULL, 'CIA World Factbook'),
('geography', 'coastline',          'Landlocked — no coastline',         0, 'km', NULL, 'CIA World Factbook'),
('geography', 'highest_point',      'Mount Aragats 4,090 m',             4090, 'm', NULL, 'CIA World Factbook'),
('geography', 'major_river',        'Araks River (Aras)',                NULL, NULL, NULL, 'CIA World Factbook'),
('geography', 'major_lake',         'Lake Sevan — largest in the region',NULL, NULL, NULL, 'CIA World Factbook'),
('geography', 'lake_sevan_area_km2','1,242',                             1242, 'km²', NULL, 'CIA World Factbook'),
('geography', 'administrative_divisions','11 provinces (marzer): Aragatsotn, Ararat, Armavir, Gegharkunik, Kotayk, Lori, Shirak, Syunik, Tavush, Vayots Dzor, Yerevan', NULL, NULL, NULL, 'Government of Armenia'),
('geography', 'climate',            'Highland continental — hot dry summers, cold winters', NULL, NULL, NULL, 'CIA World Factbook'),
('geography', 'natural_resources',  'Small deposits of gold, copper, molybdenum, zinc, bauxite', NULL, NULL, NULL, 'CIA World Factbook');

-- ── Demographics (static/structural) ──────────────────────────────
INSERT OR IGNORE INTO facts (category, key, value, value_num, unit, period, source) VALUES
('demographics', 'ethnic_groups',         'Armenian 98.1%, Yazidi 1.2%, Russian 0.4%, other 0.3%', NULL, NULL, '2011', 'National Statistics Service of Armenia'),
('demographics', 'religions',             'Armenian Apostolic 92.6%, Evangelical 1%, other 6.4%', NULL, NULL, '2011', 'National Statistics Service of Armenia'),
('demographics', 'official_language',     'Armenian (Հայերեն)', NULL, NULL, NULL, 'Constitution of Armenia'),
('demographics', 'diaspora_size',         'Estimated 7–10 million Armenians worldwide outside Armenia', 8000000, 'persons', '2023', 'Armenian Diaspora Research Center'),
('demographics', 'diaspora_top_countries','Russia, USA, France, Georgia, Lebanon, Ukraine, Argentina', NULL, NULL, '2023', 'Various sources'),
('demographics', 'yerevan_population',    'Approximately 1.07 million in the city proper', 1073000, 'persons', '2023', 'Armstat'),
('demographics', 'median_age',            '37.5 years', 37.5, 'years', '2023', 'CIA World Factbook'),
('demographics', 'sex_ratio',             '0.86 males per female (total population)', 0.86, 'ratio', '2023', 'CIA World Factbook'),
('demographics', 'urbanization_rate',     '63.3% of population in urban areas', 63.3, '%', '2023', 'CIA World Factbook');

-- ── Government ─────────────────────────────────────────────────────
INSERT OR IGNORE INTO facts (category, key, value, value_num, unit, period, source) VALUES
('government', 'government_type',      'Parliamentary republic', NULL, NULL, NULL, 'Constitution of Armenia 2015'),
('government', 'independence_date',    'September 21, 1991 (from Soviet Union)', NULL, NULL, '1991', 'Government of Armenia'),
('government', 'constitution_date',    'Current constitution adopted July 5, 1995; amended December 6, 2015', NULL, NULL, '2015', 'Government of Armenia'),
('government', 'ruling_party',         'Civil Contract Party (Hayrenik)', NULL, NULL, '2024', 'Government of Armenia'),
('government', 'prime_minister',       'Nikol Pashinyan (since 2018)', NULL, NULL, '2024', 'Government of Armenia'),
('government', 'parliament_seats',     '105 seats in National Assembly', 105, 'seats', '2024', 'National Assembly of Armenia'),
('government', 'legal_system',        'Civil law system', NULL, NULL, NULL, 'CIA World Factbook'),
('government', 'eu_membership',       'Not EU member; EU-Armenia Comprehensive and Enhanced Partnership Agreement (CEPA) since 2021', NULL, NULL, '2021', 'European Union'),
('government', 'eaeu_membership',     'Member of Eurasian Economic Union since January 2015', NULL, NULL, '2015', 'EAEU'),
('government', 'wto_membership',       'WTO member since February 5, 2003', NULL, NULL, '2003', 'WTO'),
('government', 'un_membership',        'UN member since March 2, 1992', NULL, NULL, '1992', 'United Nations');

-- ── Economy (structural facts) ─────────────────────────────────────
INSERT OR IGNORE INTO facts (category, key, value, value_num, unit, period, source) VALUES
('economy', 'currency',              'Armenian Dram (AMD, ֏)', NULL, NULL, NULL, 'Central Bank of Armenia'),
('economy', 'central_bank',         'Central Bank of Armenia (CBA), established 1993', NULL, NULL, '1993', 'CBA'),
('economy', 'stock_exchange',       'Armenia Securities Exchange (AMX)', NULL, NULL, NULL, 'AMX'),
('economy', 'major_exports',        'Copper ore, gold, aluminum, brandy, cut diamonds, clothing, IT services', NULL, NULL, '2023', 'Armstat / WTO'),
('economy', 'major_imports',        'Natural gas, petroleum products, machinery, food products, pharmaceuticals', NULL, NULL, '2023', 'Armstat'),
('economy', 'top_export_partners',  'Russia 23%, UAE 11%, China 10%, Switzerland 8%, Germany 5%', NULL, NULL, '2022', 'CIA World Factbook'),
('economy', 'top_import_partners',  'Russia 31%, China 13%, UAE 5%, Iran 5%, Germany 4%', NULL, NULL, '2022', 'CIA World Factbook'),
('economy', 'free_economic_zones',  'Alliance FEZ (Yerevan), Meridian FEZ (Gyumri), Meghri FEZ', NULL, NULL, '2024', 'Ministry of Economy'),
('economy', 'it_sector_revenue_usd','Over $1.3 billion in IT service exports (2023)', 1300000000, 'USD', '2023', 'UITE'),
('economy', 'remittances_share_gdp','Remittances account for approximately 10-12% of GDP', 11, '%', '2023', 'World Bank'),
('economy', 'top_tech_companies',   'EPAM Systems, Synopsys, PicsArt, ServiceTitan, TeamViewer (offices), Picsart', NULL, NULL, '2024', 'UITE');

-- ── Infrastructure ─────────────────────────────────────────────────
INSERT OR IGNORE INTO facts (category, key, value, value_num, unit, period, source) VALUES
('infrastructure', 'main_airport',       'Zvartnots International Airport (EVN), Yerevan', NULL, NULL, NULL, 'Civil Aviation Committee'),
('infrastructure', 'second_airport',     'Shirak Airport (LWN), Gyumri', NULL, NULL, NULL, 'Civil Aviation Committee'),
('infrastructure', 'road_network_km',    'Approximately 7,700 km of roads, 7,611 km paved', 7700, 'km', '2023', 'CIA World Factbook'),
('infrastructure', 'railway_km',         '845 km of railway (1,520 mm gauge)', 845, 'km', '2023', 'South Caucasus Railway'),
('infrastructure', 'internet_providers', 'Ucom, Viva-MTS, Team, GNC-Alfa are major ISPs', NULL, NULL, '2024', 'ANCOM'),
('infrastructure', 'mobile_operators',   'Viva-MTS, Team Telecom, Ucom (3 operators, 5G launched 2023)', NULL, NULL, '2023', 'ANCOM'),
('infrastructure', 'electricity_source', '32% nuclear (Metsamor), 35% hydro, 33% thermal', NULL, NULL, '2022', 'Energy Ministry');

-- ── Education ──────────────────────────────────────────────────────
INSERT OR IGNORE INTO facts (category, key, value, value_num, unit, period, source) VALUES
('education', 'literacy_rate',       '99.7% (virtually universal)', 99.7, '%', '2020', 'UNESCO'),
('education', 'universities_count',  'Over 60 higher education institutions', 60, 'institutions', '2023', 'Ministry of Education'),
('education', 'top_university',      'Yerevan State University (YSU), founded 1919', NULL, NULL, NULL, 'YSU'),
('education', 'stem_focus',          'Strong tradition in mathematics, physics, computer science since Soviet era', NULL, NULL, NULL, 'Various'),
('education', 'tumo_centers',        'TUMO Centers for Creative Technologies — free digital skills for youth 12-18', NULL, NULL, '2024', 'TUMO');

-- ── Culture & Tourism ───────────────────────────────────────────────
INSERT OR IGNORE INTO facts (category, key, value, value_num, unit, period, source) VALUES
('culture', 'alphabet',             'Armenian alphabet (Hayeren gir), created by Mesrop Mashtots in 405 AD', NULL, NULL, '405', 'Historical'),
('culture', 'national_holiday',     'Independence Day September 21; Republic Day May 28; Genocide Remembrance April 24', NULL, NULL, NULL, 'Government of Armenia'),
('culture', 'famous_exports',       'Cognac/brandy (Ararat), pomegranates, apricots, lavash bread (UNESCO intangible heritage)', NULL, NULL, NULL, 'Various'),
('culture', 'sports',               'Chess is a compulsory subject in schools; strong tradition in wrestling, weightlifting', NULL, NULL, NULL, 'Various'),
('tourism', 'top_attractions',      'Geghard Monastery, Garni Temple, Tatev Monastery, Lake Sevan, Noravank, Khor Virap', NULL, NULL, NULL, 'Tourism Committee'),
('tourism', 'tourists_annual',      'Approximately 1.9 million international visitors (2023)', 1900000, 'persons', '2023', 'Tourism Committee');
