// Main Application Logic
class App {
    constructor() {
        this.currentView = 'chat';
        this.init();
    }

    init() {
        this.setupNavigation();
        this.checkServerHealth();
        this.loadDashboardData();
    }

    setupNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn');

        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.getAttribute('data-view');
                this.switchView(view);

                // Update active state
                navButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    switchView(viewName) {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        // Show selected view
        const view = document.getElementById(`${viewName}-view`);
        if (view) {
            view.classList.add('active');
            this.currentView = viewName;

            // Load data for dashboard when switching to it
            if (viewName === 'dashboard') {
                this.loadDashboardData();
            }
        }
    }

    async checkServerHealth() {
        try {
            const response = await fetch('/api/health');
            const data = await response.json();

            const statusEl = document.getElementById('connection-status');
            const statusDot = document.querySelector('.status-dot');

            if (data.status === 'healthy') {
                statusEl.textContent = 'Connected';
                statusDot.style.background = 'var(--success)';
            } else {
                statusEl.textContent = 'DB Disconnected';
                statusDot.style.background = 'var(--warning)';
            }
        } catch (error) {
            console.error('Health check failed:', error);
            const statusEl = document.getElementById('connection-status');
            const statusDot = document.querySelector('.status-dot');
            statusEl.textContent = 'Server Error';
            statusDot.style.background = 'var(--error)';
        }
    }

    async loadDashboardData() {
        try {
            const response = await fetch('/api/data/summary');
            const data = await response.json();

            if (data.success) {
                this.renderStats(data.summary);
                this.renderIndustriesChart(data.topIndustries);
                this.renderRecentNews(data.recentNews);
            }
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        }
    }

    renderStats(summary) {
        const statsGrid = document.getElementById('stats-grid');
        statsGrid.innerHTML = '';

        const stats = [
            { label: 'Companies', value: summary.companies, icon: '🏢' },
            { label: 'Contacts', value: summary.contacts, icon: '👥' },
            { label: 'News Articles', value: summary.news, icon: '📰' },
            { label: 'Statistics', value: summary.statistics, icon: '📊' }
        ];

        stats.forEach(stat => {
            const card = document.createElement('div');
            card.className = 'stat-card';
            card.innerHTML = `
        <div class="stat-label">${stat.icon} ${stat.label}</div>
        <div class="stat-value">${stat.value.toLocaleString()}</div>
        <div class="stat-change">Database records</div>
      `;
            statsGrid.appendChild(card);
        });
    }

    renderIndustriesChart(industries) {
        if (!industries || industries.length === 0) return;

        const labels = industries.map(i => i.industry);
        const data = industries.map(i => parseInt(i.count));

        window.chartsComponent.createDashboardChart(
            'industries-chart',
            'doughnut',
            labels,
            [{
                data,
                backgroundColor: labels.map((_, i) => window.chartsComponent.getColor(i, 0.8)),
                borderColor: labels.map((_, i) => window.chartsComponent.getColor(i, 1)),
                borderWidth: 2
            }]
        );
    }

    renderRecentNews(news) {
        const container = document.getElementById('recent-news');
        container.innerHTML = '';

        if (!news || news.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted);">No recent news available</p>';
            return;
        }

        news.forEach(item => {
            const newsItem = document.createElement('div');
            newsItem.className = 'recent-item';

            const date = item.published_date ?
                new Date(item.published_date).toLocaleDateString() :
                'Unknown date';

            newsItem.innerHTML = `
        <div class="recent-item-title">${this.escapeHtml(item.title)}</div>
        <div class="recent-item-meta">${this.escapeHtml(item.source)} • ${date}</div>
      `;
            container.appendChild(newsItem);
        });
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new App();
    });
} else {
    window.app = new App();
}
