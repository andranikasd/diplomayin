-- Migration 0009: Armenia demographic seed data
-- Sources: Armstat (armstat.am), 2020-2022 estimates
-- Uses INSERT OR IGNORE for idempotency (works with the regional unique index from 0010)

-- ─── REGIONAL POPULATION by Armenia's 11 provinces ──────────────────────────
-- Source: Armstat permanent population register, units = persons
-- region column = province name (distinct from national rows with region='Armenia')

-- 2020
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',1082900,'persons','2020','armstat.am','https://armstat.am/en/?nid=82','Yerevan');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',119200,'persons','2020','armstat.am','https://armstat.am/en/?nid=82','Aragatsotn');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',260700,'persons','2020','armstat.am','https://armstat.am/en/?nid=82','Ararat');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',265800,'persons','2020','armstat.am','https://armstat.am/en/?nid=82','Armavir');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',225600,'persons','2020','armstat.am','https://armstat.am/en/?nid=82','Gegharkunik');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',283800,'persons','2020','armstat.am','https://armstat.am/en/?nid=82','Kotayk');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',213200,'persons','2020','armstat.am','https://armstat.am/en/?nid=82','Lori');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',234100,'persons','2020','armstat.am','https://armstat.am/en/?nid=82','Shirak');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',144200,'persons','2020','armstat.am','https://armstat.am/en/?nid=82','Syunik');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',119800,'persons','2020','armstat.am','https://armstat.am/en/?nid=82','Tavush');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',52600,'persons','2020','armstat.am','https://armstat.am/en/?nid=82','Vayots Dzor');

-- 2021
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',1086900,'persons','2021','armstat.am','https://armstat.am/en/?nid=82','Yerevan');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',117500,'persons','2021','armstat.am','https://armstat.am/en/?nid=82','Aragatsotn');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',259400,'persons','2021','armstat.am','https://armstat.am/en/?nid=82','Ararat');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',264100,'persons','2021','armstat.am','https://armstat.am/en/?nid=82','Armavir');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',222400,'persons','2021','armstat.am','https://armstat.am/en/?nid=82','Gegharkunik');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',282400,'persons','2021','armstat.am','https://armstat.am/en/?nid=82','Kotayk');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',210800,'persons','2021','armstat.am','https://armstat.am/en/?nid=82','Lori');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',231600,'persons','2021','armstat.am','https://armstat.am/en/?nid=82','Shirak');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',142900,'persons','2021','armstat.am','https://armstat.am/en/?nid=82','Syunik');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',118000,'persons','2021','armstat.am','https://armstat.am/en/?nid=82','Tavush');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',51900,'persons','2021','armstat.am','https://armstat.am/en/?nid=82','Vayots Dzor');

-- 2022
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',1090100,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Yerevan');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',116200,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Aragatsotn');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',258100,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Ararat');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',262400,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Armavir');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',219200,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Gegharkunik');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',281000,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Kotayk');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',208400,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Lori');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',229200,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Shirak');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',141700,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Syunik');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',116300,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Tavush');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, total',51200,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Vayots Dzor');

-- ─── AGE PYRAMID — 5-year cohorts (Armstat 2022 estimate) ───────────────────
-- National level (region = 'Armenia'), 17 cohorts totalling ~2,974,000

INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population ages 0-4',138900,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population ages 5-9',156400,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population ages 10-14',181600,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population ages 15-19',191400,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population ages 20-24',207200,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population ages 25-29',221300,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population ages 30-34',244700,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population ages 35-39',252200,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population ages 40-44',241000,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population ages 45-49',210600,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population ages 50-54',175100,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population ages 55-59',163000,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population ages 60-64',184500,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population ages 65-69',162300,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population ages 70-74',114900,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population ages 75-79',77700,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population ages 80 and above',57500,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');

-- ─── GENDER BREAKDOWN ────────────────────────────────────────────────────────

INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, male',1385500,'persons','2020','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, female',1578400,'persons','2020','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, male',1382100,'persons','2021','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, female',1577100,'persons','2021','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, male',1388300,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Population, female',1585700,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');

-- ─── URBAN vs RURAL (absolute) ───────────────────────────────────────────────

INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Urban population',1885200,'persons','2020','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Rural population',1078700,'persons','2020','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Urban population',1899500,'persons','2021','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Rural population',1059700,'persons','2021','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Urban population',1912800,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Rural population',1061200,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');

-- ─── VITAL STATISTICS (births, deaths, marriages) ───────────────────────────

INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Live births',39600,'persons','2020','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Deaths',30200,'persons','2020','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Natural population increase',9400,'persons','2020','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Marriages registered',17800,'number','2020','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Divorces registered',6400,'number','2020','armstat.am','https://armstat.am/en/?nid=82','Armenia');

INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Live births',41400,'persons','2021','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Deaths',33800,'persons','2021','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Natural population increase',7600,'persons','2021','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Marriages registered',20200,'number','2021','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Divorces registered',7100,'number','2021','armstat.am','https://armstat.am/en/?nid=82','Armenia');

INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Live births',40200,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Deaths',29400,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Natural population increase',10800,'persons','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Marriages registered',22600,'number','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');
INSERT OR IGNORE INTO statistics (category, indicator, value, unit, period, source, source_url, region) VALUES ('demographics','Divorces registered',7500,'number','2022','armstat.am','https://armstat.am/en/?nid=82','Armenia');

-- ─── DEMOGRAPHIC FACTS ───────────────────────────────────────────────────────

INSERT OR IGNORE INTO facts (category, key, value, value_num, unit, period, source, notes) VALUES
  ('demographics','population_by_region_available','Yes',1,'boolean','2022','armstat.am',
   'Regional population (2020-2022) available for all 11 Armenian provinces: Yerevan, Aragatsotn, Ararat, Armavir, Gegharkunik, Kotayk, Lori, Shirak, Syunik, Tavush, Vayots Dzor. Query: SELECT region, value FROM statistics WHERE indicator=''Population, total'' AND source=''armstat.am'' ORDER BY value DESC');

INSERT OR IGNORE INTO facts (category, key, value, value_num, unit, period, source, notes) VALUES
  ('demographics','age_pyramid_available','Yes',1,'boolean','2022','armstat.am',
   '5-year age cohort breakdown for 2022 in statistics table. Query: SELECT indicator, value FROM statistics WHERE indicator LIKE ''Population ages%'' AND period=''2022'' ORDER BY indicator');

INSERT OR IGNORE INTO facts (category, key, value, value_num, unit, period, source, notes) VALUES
  ('demographics','largest_region_by_population','Yerevan',NULL,NULL,'2022','armstat.am',
   'Yerevan (capital) accounts for ~36.6% of total Armenian population with 1,090,100 residents in 2022');

INSERT OR IGNORE INTO facts (category, key, value, value_num, unit, period, source, notes) VALUES
  ('demographics','smallest_region_by_population','Vayots Dzor',NULL,NULL,'2022','armstat.am',
   'Vayots Dzor is the least populous province with ~51,200 residents in 2022');

INSERT OR IGNORE INTO facts (category, key, value, value_num, unit, period, source, notes) VALUES
  ('demographics','population_gender_ratio_female','53.3',53.3,'%','2022','armstat.am',
   'Armenia has more women than men (53.3% female) — common in post-Soviet states due to male emigration and higher male mortality');

INSERT OR IGNORE INTO facts (category, key, value, value_num, unit, period, source, notes) VALUES
  ('demographics','median_age','38.2',38.2,'years','2022','armstat.am',
   'Estimated median age. Armenia has an aging population — median age has risen from 34.0 in 2010 to ~38.2 in 2022');

INSERT OR IGNORE INTO facts (category, key, value, value_num, unit, period, source, notes) VALUES
  ('demographics','urbanization_rate','64.3',64.3,'%','2022','armstat.am',
   '64.3% of population lives in urban areas; Yerevan alone holds ~57% of all urban residents');

INSERT OR IGNORE INTO facts (category, key, value, value_num, unit, period, source, notes) VALUES
  ('demographics','population_working_age_pct','67.7',67.7,'%','2022','World Bank',
   'Working-age population (15-64) as % of total — slightly above global average');

INSERT OR IGNORE INTO facts (category, key, value, value_num, unit, period, source, notes) VALUES
  ('demographics','dependency_ratio','47.7',47.7,'%','2022','World Bank',
   'Age dependency ratio: 32.3% from youth + 15.4% from elderly aged 65+');
