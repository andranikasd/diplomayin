const BaseScraper = require('./base');

/**
 * Armenian News & Data Scraper
 * Sources: news.am, armenpress.am, armstat.am
 */
class ArmeniaScraper extends BaseScraper {
    constructor(db) {
        super('ArmeniaScraper', db);
    }

    // =============================================
    // NEWS.AM scraper
    // URL: https://news.am/eng/
    // =============================================
    async scrapeNewsAm() {
        const source = { name: 'News.am', url: 'https://news.am/eng/' };
        const jobId = await this.createJob('news', source.name, source.url);

        try {
            await this.updateJobStatus(jobId, 'running');
            const html = await this.fetch(source.url);
            const $ = this.parseHTML(html);
            let itemsScraped = 0;

            // news.am English — articles appear as list items or divs with .news
            // Multiple selector fallbacks for resilience
            const articleSelectors = [
                '.news-feed .article',
                '.lenta-item',
                '.news_block',
                'article',
                '.main-articles .item',
                '.items-block .item'
            ];

            let $articles = $([]);
            for (const sel of articleSelectors) {
                const found = $(sel);
                if (found.length > 0) { $articles = found; break; }
            }

            // If structured selectors fail, try extracting links directly
            if ($articles.length === 0) {
                $articles = $('a[href*="/news/"]').slice(0, 30);
            }

            const seen = new Set();

            for (let i = 0; i < Math.min($articles.length, 25); i++) {
                const elem = $articles.eq(i);

                let title = this.normalizeText(
                    elem.find('h1, h2, h3, h4, .title, .headline').first().text() ||
                    elem.find('a').first().text() ||
                    elem.attr('title') || ''
                );

                let link = elem.find('a').first().attr('href') || elem.attr('href') || '';
                if (!link.startsWith('http')) {
                    link = link.startsWith('/') ? 'https://news.am' + link : source.url + link;
                }

                const dateStr = this.normalizeText(elem.find('time, .date, .time, [datetime]').first().text());
                const summary = this.normalizeText(elem.find('.summary, .excerpt, .description, p').first().text());
                const category = this.extractCategory(link, elem.find('.category, .tag').first().text());

                if (!title || title.length < 5 || seen.has(link)) continue;
                seen.add(link);

                try {
                    await this.saveToDatabase('news_articles', {
                        title: title.slice(0, 490),
                        title_am: null,
                        content: null,
                        summary: summary ? summary.slice(0, 1000) : null,
                        author: null,
                        source: source.name,
                        source_url: link,
                        published_date: this.parseDate(dateStr),
                        category: category || 'general',
                        sentiment: 'neutral',
                        language: 'en'
                    });
                    itemsScraped++;
                } catch (err) {
                    // Skip duplicates (unique constraint)
                    if (!err.message.includes('duplicate')) {
                        this.logger.error('Error saving news.am item:', err.message);
                    }
                }
            }

            await this.updateJobStatus(jobId, 'completed', itemsScraped);
            this.logger.info(`✅ news.am: scraped ${itemsScraped} articles`);
            return { source: source.name, success: true, itemsScraped };
        } catch (error) {
            await this.updateJobStatus(jobId, 'failed', 0, error.message);
            this.logger.error(`❌ news.am failed: ${error.message}`);
            return { source: source.name, success: false, error: error.message };
        }
    }

    // =============================================
    // ARMENPRESS.AM scraper
    // URL: https://armenpress.am/eng/
    // =============================================
    async scrapeArmenpress() {
        const source = { name: 'Armenpress', url: 'https://armenpress.am/eng/news/' };
        const jobId = await this.createJob('news', source.name, source.url);

        try {
            await this.updateJobStatus(jobId, 'running');
            const html = await this.fetch(source.url);
            const $ = this.parseHTML(html);
            let itemsScraped = 0;

            // Armenpress uses .news-item, .article-item, or ul.news > li
            const articleSelectors = [
                '.news-list .news-item',
                '.articles-list article',
                '.news-block',
                '.news_list li',
                'ul.news li',
                'article',
                '.content-list .item'
            ];

            let $articles = $([]);
            for (const sel of articleSelectors) {
                const found = $(sel);
                if (found.length > 0) { $articles = found; break; }
            }

            if ($articles.length === 0) {
                $articles = $('a[href*="/news/"]').slice(0, 30);
            }

            const seen = new Set();

            for (let i = 0; i < Math.min($articles.length, 25); i++) {
                const elem = $articles.eq(i);

                let title = this.normalizeText(
                    elem.find('h1, h2, h3, h4, .title, .headline').first().text() ||
                    elem.find('a').first().text() ||
                    elem.attr('title') || ''
                );

                let link = elem.find('a').first().attr('href') || elem.attr('href') || '';
                if (!link.startsWith('http')) {
                    link = link.startsWith('/') ? 'https://armenpress.am' + link : source.url + link;
                }

                const dateStr = this.normalizeText(elem.find('time, .date, .time, [datetime]').first().text());
                const summary = this.normalizeText(elem.find('.summary, .excerpt, .intro, .lead, p').first().text());
                const category = this.extractCategory(link, elem.find('.category, .rubric, .tag').first().text());

                if (!title || title.length < 5 || seen.has(link)) continue;
                seen.add(link);

                try {
                    await this.saveToDatabase('news_articles', {
                        title: title.slice(0, 490),
                        title_am: null,
                        content: null,
                        summary: summary ? summary.slice(0, 1000) : null,
                        author: null,
                        source: source.name,
                        source_url: link,
                        published_date: this.parseDate(dateStr),
                        category: category || 'general',
                        sentiment: 'neutral',
                        language: 'en'
                    });
                    itemsScraped++;
                } catch (err) {
                    if (!err.message.includes('duplicate')) {
                        this.logger.error('Error saving armenpress item:', err.message);
                    }
                }
            }

            await this.updateJobStatus(jobId, 'completed', itemsScraped);
            this.logger.info(`✅ Armenpress: scraped ${itemsScraped} articles`);
            return { source: source.name, success: true, itemsScraped };
        } catch (error) {
            await this.updateJobStatus(jobId, 'failed', 0, error.message);
            this.logger.error(`❌ Armenpress failed: ${error.message}`);
            return { source: source.name, success: false, error: error.message };
        }
    }

    // =============================================
    // ARMSTAT.AM statistics scraper
    // URL: https://www.armstat.am/en/
    // =============================================
    async scrapeStatistics(url = 'https://www.armstat.am/en/') {
        const jobId = await this.createJob('statistics', 'armstat.am', url);

        try {
            await this.updateJobStatus(jobId, 'running');
            const html = await this.fetch(url);
            const $ = this.parseHTML(html);
            let itemsScraped = 0;

            // Try to find key indicators on the homepage
            const indicatorSelectors = [
                '.indicator-block',
                '.stat-item',
                '.key-figure',
                'table.statistics tr',
                '.main-indicators tr',
                '.data-block'
            ];

            let $items = $([]);
            for (const sel of indicatorSelectors) {
                const found = $(sel);
                if (found.length > 0) { $items = found; break; }
            }

            for (let i = 0; i < Math.min($items.length, 50); i++) {
                const elem = $items.eq(i);

                let indicator = this.normalizeText(
                    elem.find('.indicator-name, .label, th, td:first-child').first().text()
                );
                let valueRaw = this.normalizeText(
                    elem.find('.value, .indicator-value, td:nth-child(2)').first().text()
                );

                if (!indicator || !valueRaw) continue;

                const numericValue = parseFloat(valueRaw.replace(/[^0-9.-]/g, '')) || null;
                const unit = this.extractUnit(valueRaw);
                const period = this.normalizeText(elem.find('.period, td:nth-child(3), .year').first().text())
                    || new Date().getFullYear().toString();

                try {
                    await this.saveToDatabase('statistics', {
                        category: 'economy',
                        indicator: indicator.slice(0, 250),
                        value: numericValue,
                        unit,
                        period,
                        source: 'armstat.am',
                        source_url: url,
                        notes: null
                    });
                    itemsScraped++;
                } catch (err) {
                    if (!err.message.includes('duplicate')) {
                        this.logger.error('Error saving statistic:', err.message);
                    }
                }
            }

            await this.updateJobStatus(jobId, 'completed', itemsScraped);
            this.logger.info(`✅ armstat.am: scraped ${itemsScraped} statistics`);
            return { success: true, itemsScraped };
        } catch (error) {
            await this.updateJobStatus(jobId, 'failed', 0, error.message);
            this.logger.error(`❌ armstat.am failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    // =============================================
    // Combined scrapeNews (runs both sources)
    // =============================================
    async scrapeNews() {
        const results = await Promise.allSettled([
            this.scrapeNewsAm(),
            this.scrapeArmenpress()
        ]);

        return results.map(r =>
            r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message }
        );
    }

    // =============================================
    // Company scraper (placeholder — registry is gated)
    // =============================================
    async scrapeCompanies(url = 'https://www.e-register.am/en/') {
        const jobId = await this.createJob('company', 'e-register.am', url);

        try {
            await this.updateJobStatus(jobId, 'running');
            const html = await this.fetch(url);
            const $ = this.parseHTML(html);
            let itemsScraped = 0;

            // e-register.am search results (requires a query param)
            $('.search-result, .company-item, tr.company-row').each(async (_, elem) => {
                const name = this.normalizeText($(elem).find('.name, td:first-child, h3').first().text());
                const regNum = this.normalizeText($(elem).find('.reg-num, td:nth-child(2)').first().text());
                const industry = this.normalizeText($(elem).find('.industry, .activity').first().text());

                if (!name) return;

                try {
                    await this.saveToDatabase('companies', {
                        name: name.slice(0, 250),
                        industry: industry ? industry.slice(0, 100) : null,
                        registration_number: regNum ? regNum.slice(0, 100) : null,
                        country: 'Armenia',
                        source: 'e-register.am',
                        source_url: url
                    });
                    itemsScraped++;
                } catch (err) {
                    if (!err.message.includes('duplicate')) {
                        this.logger.error('Error saving company:', err.message);
                    }
                }
            });

            await this.updateJobStatus(jobId, 'completed', itemsScraped);
            this.logger.info(`✅ Companies: scraped ${itemsScraped}`);
            return { success: true, itemsScraped };
        } catch (error) {
            await this.updateJobStatus(jobId, 'failed', 0, error.message);
            this.logger.error(`❌ Company scrape failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    // =============================================
    // Helpers
    // =============================================
    extractUnit(valueString) {
        if (!valueString) return null;
        const units = ['%', 'USD', 'AMD', 'EUR', 'GBP', 'million', 'billion', 'thousand', 'mln', 'bln', 'kg', 'ton'];
        for (const unit of units) {
            if (valueString.includes(unit)) return unit;
        }
        return null;
    }

    parseDate(dateStr) {
        if (!dateStr) return new Date();
        const parsed = new Date(dateStr);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
    }

    extractCategory(url = '', categoryText = '') {
        const text = (url + ' ' + categoryText).toLowerCase();
        if (text.includes('tech') || text.includes('it')) return 'technology';
        if (text.includes('econom') || text.includes('financ') || text.includes('biz')) return 'economy';
        if (text.includes('politi') || text.includes('govern')) return 'politics';
        if (text.includes('sport')) return 'sports';
        if (text.includes('cultur') || text.includes('art')) return 'culture';
        if (text.includes('health') || text.includes('med')) return 'health';
        if (text.includes('world') || text.includes('international')) return 'world';
        return 'general';
    }
}

module.exports = ArmeniaScraper;
