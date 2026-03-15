// Results Display Component
class ResultsComponent {
    constructor() {
        this.sidebar = document.getElementById('results-sidebar');
        this.content = document.getElementById('results-content');
        this.closeBtn = document.getElementById('close-results');

        this.closeBtn.addEventListener('click', () => this.hide());
    }

    showResults(data) {
        this.content.innerHTML = '';

        // Show SQL query
        this.addSection('Generated SQL Query', this.createSQLDisplay(data.sql));

        // Show data table
        if (data.results && data.results.length > 0) {
            this.addSection('Data Results', this.createDataTable(data.results));

            // Show chart if recommended
            if (data.visualization && data.visualization.suggestChart) {
                this.addSection('Visualization', this.createChart(data.results, data.visualization));
            }

            // Add export options
            this.addExportOptions(data.results);
        }

        this.sidebar.classList.add('active');
    }

    hide() {
        this.sidebar.classList.remove('active');
    }

    addSection(title, content) {
        const section = document.createElement('div');
        section.style.marginBottom = 'var(--spacing-lg)';
        section.innerHTML = `<h4 style="margin-bottom: var(--spacing-md); color: var(--text-primary);">${title}</h4>`;
        section.appendChild(content);
        this.content.appendChild(section);
    }

    createSQLDisplay(sql) {
        const pre = document.createElement('pre');
        pre.className = 'sql-query';
        pre.textContent = sql;
        return pre;
    }

    createDataTable(data) {
        if (!data || data.length === 0) {
            const p = document.createElement('p');
            p.textContent = 'No data to display';
            p.style.color = 'var(--text-secondary)';
            return p;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'data-table-wrapper';

        const table = document.createElement('table');
        table.className = 'data-table';

        // Headers
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        Object.keys(data[0]).forEach(key => {
            const th = document.createElement('th');
            th.textContent = key;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body
        const tbody = document.createElement('tbody');
        data.slice(0, 100).forEach(row => { // Limit to 100 rows for performance
            const tr = document.createElement('tr');
            Object.values(row).forEach(value => {
                const td = document.createElement('td');
                td.textContent = this.formatValue(value);
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);

        wrapper.appendChild(table);

        if (data.length > 100) {
            const note = document.createElement('p');
            note.style.marginTop = 'var(--spacing-sm)';
            note.style.fontSize = '0.85rem';
            note.style.color = 'var(--text-muted)';
            note.textContent = `Showing first 100 of ${data.length} results`;
            wrapper.appendChild(note);
        }

        return wrapper;
    }

    createChart(data, visualization) {
        const container = document.createElement('div');
        container.className = 'chart-container';

        const canvas = document.createElement('canvas');
        canvas.id = 'results-chart-' + Date.now();
        container.appendChild(canvas);

        // Defer chart creation to next tick to ensure canvas is in DOM
        setTimeout(() => {
            window.chartsComponent.createChart(canvas.id, data, visualization);
        }, 0);

        return container;
    }

    addExportOptions(data) {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.gap = 'var(--spacing-sm)';
        container.style.marginTop = 'var(--spacing-lg)';

        const csvBtn = document.createElement('button');
        csvBtn.className = 'view-results-btn';
        csvBtn.textContent = '📥 Export CSV';
        csvBtn.onclick = () => this.exportToCSV(data);

        const jsonBtn = document.createElement('button');
        jsonBtn.className = 'view-results-btn';
        jsonBtn.textContent = '📥 Export JSON';
        jsonBtn.onclick = () => this.exportToJSON(data);

        container.appendChild(csvBtn);
        container.appendChild(jsonBtn);
        this.content.appendChild(container);
    }

    exportToCSV(data) {
        if (!data || data.length === 0) return;

        const headers = Object.keys(data[0]);
        const csv = [
            headers.join(','),
            ...data.map(row =>
                headers.map(header => {
                    const value = row[header];
                    const stringValue = value === null ? '' : String(value);
                    return stringValue.includes(',') ? `"${stringValue}"` : stringValue;
                }).join(',')
            )
        ].join('\n');

        this.downloadFile(csv, 'export.csv', 'text/csv');
    }

    exportToJSON(data) {
        const json = JSON.stringify(data, null, 2);
        this.downloadFile(json, 'export.json', 'application/json');
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    formatValue(value) {
        if (value === null || value === undefined) return '-';
        if (typeof value === 'number') {
            return value.toLocaleString();
        }
        if (value instanceof Date) {
            return value.toLocaleDateString();
        }
        return String(value);
    }
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.resultsComponent = new ResultsComponent();
    });
} else {
    window.resultsComponent = new ResultsComponent();
}
