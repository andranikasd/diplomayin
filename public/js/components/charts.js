// Charts Component using Chart.js
class ChartsComponent {
    constructor() {
        this.charts = {};
        this.colors = {
            primary: '#667eea',
            secondary: '#764ba2',
            accent: '#f093fb',
            success: '#48bb78',
            warning: '#ed8936',
            error: '#f56565'
        };
    }

    createChart(canvasId, data, config) {
        // Destroy existing chart if it exists
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error('Canvas not found:', canvasId);
            return;
        }

        const ctx = canvas.getContext('2d');
        const chartType = config.chartType || 'bar';

        let chartData;
        if (chartType === 'pie' || chartType === 'doughnut') {
            chartData = this.preparePieData(data, config);
        } else {
            chartData = this.prepareBarLineData(data, config);
        }

        this.charts[canvasId] = new Chart(ctx, {
            type: chartType,
            data: chartData,
            options: this.getChartOptions(chartType)
        });
    }

    prepareBarLineData(data, config) {
        const labels = data.map(row => row[config.labelColumn]);
        const datasets = config.dataColumns.map((col, index) => ({
            label: col,
            data: data.map(row => row[col]),
            backgroundColor: this.getColor(index, 0.6),
            borderColor: this.getColor(index, 1),
            borderWidth: 2
        }));

        return { labels, datasets };
    }

    preparePieData(data, config) {
        const labels = data.map(row => row[config.labelColumn]);
        const dataValues = data.map(row => row[config.dataColumns[0]]);

        return {
            labels,
            datasets: [{
                data: dataValues,
                backgroundColor: labels.map((_, i) => this.getColor(i, 0.8)),
                borderColor: labels.map((_, i) => this.getColor(i, 1)),
                borderWidth: 2
            }]
        };
    }

    getColor(index, alpha = 1) {
        const colorArray = Object.values(this.colors);
        const color = colorArray[index % colorArray.length];

        // Convert hex to rgba
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    getChartOptions(type) {
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: {
                        color: '#a0aec0',
                        font: {
                            family: 'Inter',
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 29, 41, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#a0aec0',
                    borderColor: '#667eea',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    font: {
                        family: 'Inter'
                    }
                }
            }
        };

        if (type === 'bar' || type === 'line') {
            return {
                ...commonOptions,
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#a0aec0',
                            font: {
                                family: 'Inter',
                                size: 11
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#a0aec0',
                            font: {
                                family: 'Inter',
                                size: 11
                            }
                        }
                    }
                }
            };
        }

        return commonOptions;
    }

    // Dashboard-specific chart creation
    createDashboardChart(canvasId, type, labels, datasets) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        this.charts[canvasId] = new Chart(ctx, {
            type,
            data: { labels, datasets },
            options: this.getChartOptions(type)
        });
    }
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.chartsComponent = new ChartsComponent();
    });
} else {
    window.chartsComponent = new ChartsComponent();
}
