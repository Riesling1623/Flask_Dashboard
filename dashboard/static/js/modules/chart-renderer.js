// modules/chart-renderer.js - Handle all chart rendering

export class ChartRenderer {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }
    
    // Render all charts
    renderAllCharts() {
        const data = this.dashboard.getCurrentData();
        if (!data) return;

        this.destroyExistingCharts();
        this.renderTimelineChart();
        this.renderTopIPsChart();
        this.renderDangerousCommandsChart();
        this.renderCredentialAnalysisCharts();
        this.renderAttackTimingAnalysis();
    }
    
    // Destroy existing charts to prevent memory leaks
    destroyExistingCharts() {
        const charts = this.dashboard.getAllCharts();
        Object.values(charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
    }
    
    // Timeline Chart
    renderTimelineChart() {
        const data = this.dashboard.getCurrentData();
        const dailySessions = data.daily_sessions || {};
        const dates = Object.keys(dailySessions).sort();
        
        const timelineContainer = document.getElementById('timelineChartContainer');
        if (dates.length < 2) {
            timelineContainer.style.display = 'none';
            return;
        }
        
        timelineContainer.style.display = 'block';
        
        const ctx = document.getElementById('timelineChart').getContext('2d');
        const sessionCounts = dates.map(date => dailySessions[date]);
        
        const formattedDates = dates.map(date => {
            const d = new Date(date);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
        
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: formattedDates,
                datasets: [{
                    label: 'Sessions per Day',
                    data: sessionCounts,
                    borderColor: '#3b82f6',
                    backgroundColor: this.createGradient(ctx, 'rgba(59, 130, 246, 0.2)', 'rgba(59, 130, 246, 0.02)'),
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#3b82f6',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: this.getTimelineChartOptions(dates)
        });
        
        this.dashboard.setChart('timeline', chart);
    }
    
    // Top IPs Chart
    renderTopIPsChart() {
        const data = this.dashboard.getCurrentData();
        const topIPs = Object.entries(data.top_ips || {})
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        const ctx = document.getElementById('topIPsChart').getContext('2d');
        
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topIPs.map(([ip]) => ip),
                datasets: [{
                    label: 'Connection Count',
                    data: topIPs.map(([,count]) => count),
                    backgroundColor: this.createGradient(ctx, '#3b82f6', '#1d4ed8'),
                    borderColor: '#3b82f6',
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false,
                }]
            },
            options: this.getBarChartOptions('IP Addresses')
        });
        
        this.dashboard.setChart('topIPs', chart);
    }
    
    // Dangerous Commands Chart
    renderDangerousCommandsChart() {
        const data = this.dashboard.getCurrentData();
        const dangerousCmds = Object.entries(data.dangerous_commands || {})
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        const ctx = document.getElementById('dangerousCmdChart').getContext('2d');
        
        if (dangerousCmds.length > 0) {
            const chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: dangerousCmds.map(([cmd]) => cmd.length > 20 ? cmd.substring(0, 20) + '...' : cmd),
                    datasets: [{
                        label: 'Usage Count',
                        data: dangerousCmds.map(([,count]) => count),
                        backgroundColor: this.createGradient(ctx, '#ef4444', '#dc2626'),
                        borderColor: '#ef4444',
                        borderWidth: 2,
                        borderRadius: 8,
                        borderSkipped: false,
                    }]
                },
                options: this.getBarChartOptions('Dangerous Commands', dangerousCmds)
            });
            
            this.dashboard.setChart('dangerousCommands', chart);
        } else {
            this.renderEmptyChart(ctx, 'No dangerous commands detected');
        }
    }
    
    // Credential Analysis Charts
    renderCredentialAnalysisCharts() {
        this.renderFailedLoginsChart();
        this.renderLoginRatioChart();
        this.renderPasswordAnalysisCharts();
    }
    
    // Failed Logins Chart
    renderFailedLoginsChart() {
        const data = this.dashboard.getCurrentData();
        const failedLogins = data.failed_logins || {};
        const successfulLogins = data.successful_logins || {};
        
        const usernameStats = this.processUsernameStats(failedLogins, successfulLogins);
        const sortedUsernames = Object.entries(usernameStats)
            .map(([username, stats]) => ({
                username,
                failed: stats.failed,
                successful: stats.successful,
                total: stats.failed + stats.successful
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);
        
        const ctx = document.getElementById('failedLoginsChart').getContext('2d');
        
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedUsernames.map(item => item.username),
                datasets: [
                    {
                        label: 'Failed Attempts',
                        data: sortedUsernames.map(item => item.failed),
                        backgroundColor: this.createGradient(ctx, '#ef4444', '#dc2626'),
                        borderColor: '#ef4444',
                        borderWidth: 2,
                        borderRadius: 6,
                        borderSkipped: false,
                    },
                    {
                        label: 'Successful Logins',
                        data: sortedUsernames.map(item => item.successful),
                        backgroundColor: this.createGradient(ctx, '#10b981', '#059669'),
                        borderColor: '#10b981',
                        borderWidth: 2,
                        borderRadius: 6,
                        borderSkipped: false,
                    }
                ]
            },
            options: this.getFailedLoginsChartOptions(sortedUsernames)
        });
        
        this.dashboard.setChart('failedLogins', chart);
    }
    
    // Login Ratio Chart
    renderLoginRatioChart() {
        const data = this.dashboard.getCurrentData();
        const failedLogins = data.failed_logins || {};
        const successfulLogins = data.successful_logins || {};
        
        const totalFailed = Object.values(failedLogins).reduce((sum, count) => sum + count, 0);
        const totalSuccessful = Object.values(successfulLogins).reduce((sum, count) => sum + count, 0);
        const total = totalFailed + totalSuccessful;
        
        const ctx = document.getElementById('loginRatioChart').getContext('2d');
        
        if (total === 0) {
            this.renderEmptyChart(ctx, 'No login data available');
            return;
        }
        
        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Failed Attempts', 'Successful Logins'],
                datasets: [{
                    data: [totalFailed, totalSuccessful],
                    backgroundColor: ['#ef4444', '#10b981'],
                    borderColor: ['#dc2626', '#059669'],
                    borderWidth: 3,
                    hoverBorderWidth: 4,
                    hoverOffset: 8
                }]
            },
            options: this.getDoughnutChartOptions(total)
        });
        
        this.dashboard.setChart('loginRatio', chart);
    }
    
    // Password Analysis Charts
    renderPasswordAnalysisCharts() {
        this.renderPasswordLengthChart();
        this.renderPasswordPatternsChart();
        this.renderTopPasswordsChart();
    }
    
    // Password Length Chart
    renderPasswordLengthChart() {
        const data = this.dashboard.getCurrentData();
        const passwordAnalysis = data.password_analysis;
        
        if (!passwordAnalysis || !passwordAnalysis.length_distribution) {
            this.renderEmptyChart(document.getElementById('passwordLengthChart').getContext('2d'), 'No password data available');
            return;
        }
        
        const lengthData = passwordAnalysis.length_distribution;
        const sortedLengths = Object.entries(lengthData)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .slice(0, 15);
        
        const ctx = document.getElementById('passwordLengthChart').getContext('2d');
        
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedLengths.map(([length]) => `${length} chars`),
                datasets: [{
                    label: 'Number of Passwords',
                    data: sortedLengths.map(([, count]) => count),
                    borderColor: '#8b5cf6',
                    backgroundColor: this.createGradient(ctx, 'rgba(139, 92, 246, 0.2)', 'rgba(139, 92, 246, 0.02)'),
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#8b5cf6',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: this.getLineChartOptions('Password Length Distribution')
        });
        
        this.dashboard.setChart('passwordLength', chart);
    }
    
    // Password Patterns Chart
    renderPasswordPatternsChart() {
        const data = this.dashboard.getCurrentData();
        const passwordAnalysis = data.password_analysis;
        
        if (!passwordAnalysis || !passwordAnalysis.pattern_distribution) {
            this.renderEmptyChart(document.getElementById('passwordPatternsChart').getContext('2d'), 'No pattern data available');
            return;
        }
        
        const patterns = passwordAnalysis.pattern_distribution;
        const patternLabels = {
            'numeric_only': 'Numbers Only',
            'alpha_only': 'Letters Only', 
            'alphanumeric': 'Letters + Numbers',
            'special_chars': 'With Special Characters',
            'empty': 'Empty Password',
            'common_weak': 'Common Weak Passwords'
        };
        
        const patternColors = {
            'numeric_only': '#ef4444',
            'alpha_only': '#f59e0b',
            'alphanumeric': '#10b981',
            'special_chars': '#3b82f6',
            'empty': '#6b7280',
            'common_weak': '#dc2626'
        };
        
        const filteredPatterns = Object.entries(patterns).filter(([, count]) => count > 0);
        
        const ctx = document.getElementById('passwordPatternsChart').getContext('2d');
        
        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: filteredPatterns.map(([pattern]) => patternLabels[pattern]),
                datasets: [{
                    data: filteredPatterns.map(([, count]) => count),
                    backgroundColor: filteredPatterns.map(([pattern]) => patternColors[pattern]),
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    hoverBorderWidth: 3,
                    hoverOffset: 6
                }]
            },
            options: this.getPatternChartOptions()
        });
        
        this.dashboard.setChart('passwordPatterns', chart);
    }
    
    // Top Passwords Chart
    renderTopPasswordsChart() {
        const data = this.dashboard.getCurrentData();
        const passwordAnalysis = data.password_analysis;
        
        if (!passwordAnalysis || !passwordAnalysis.top_passwords) {
            this.renderEmptyChart(document.getElementById('topPasswordsChart').getContext('2d'), 'No password data available');
            return;
        }
        
        const topPasswords = Object.entries(passwordAnalysis.top_passwords)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);
        
        if (topPasswords.length === 0) {
            this.renderEmptyChart(document.getElementById('topPasswordsChart').getContext('2d'), 'No password data available');
            return;
        }
        
        const ctx = document.getElementById('topPasswordsChart').getContext('2d');
        
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topPasswords.map(([password]) => password || '(empty)'),
                datasets: [{
                    label: 'Usage Count',
                    data: topPasswords.map(([, count]) => count),
                    backgroundColor: this.createGradient(ctx, '#8b5cf6', '#7c3aed'),
                    borderColor: '#8b5cf6',
                    borderWidth: 2,
                    borderRadius: 6,
                    borderSkipped: false,
                }]
            },
            options: this.getHorizontalBarChartOptions('Top Passwords')
        });
        
        this.dashboard.setChart('topPasswords', chart);
    }
    
    // Attack Timing Analysis
    renderAttackTimingAnalysis() {
        const data = this.dashboard.getCurrentData();
        if (!data || !data.attack_timing) return;
        
        this.renderHourlyAttacksChart();
        this.renderWeeklyAttacksChart();
        this.renderAttackHeatMap();
    }
    
    // Hourly Attacks Chart
    renderHourlyAttacksChart() {
        const data = this.dashboard.getCurrentData();
        const hourlyData = data.attack_timing.hourly_distribution || {};
        const ctx = document.getElementById('hourlyAttacksChart').getContext('2d');

        const labels = Array.from({length: 24}, (_, i) => {
            const hour = i.toString().padStart(2, '0');
            return `${hour}:00`;
        });

        const chartData = labels.map((_, hour) => hourlyData[hour] || 0);

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Attack Count',
                    data: chartData,
                    borderColor: '#f59e0b',
                    backgroundColor: this.createGradient(ctx, 'rgba(245, 158, 11, 0.2)', 'rgba(245, 158, 11, 0.05)'),
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#f59e0b',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: this.getHourlyChartOptions()
        });

        this.dashboard.setChart('hourlyAttacks', chart);
    }
    
    // Weekly Attacks Chart
    renderWeeklyAttacksChart() {
        const data = this.dashboard.getCurrentData();
        const weeklyData = data.attack_timing.daily_distribution || {};
        const ctx = document.getElementById('weeklyAttacksChart').getContext('2d');
        
        const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const chartData = dayLabels.map((_, index) => weeklyData[index] || 0);
        
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dayLabels,
                datasets: [{
                    label: 'Attack Count',
                    data: chartData,
                    backgroundColor: this.createGradient(ctx, '#f59e0b', '#d97706'),
                    borderColor: '#f59e0b',
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: this.getWeeklyChartOptions()
        });
        
        this.dashboard.setChart('weeklyAttacks', chart);
    }
    
    // Attack Heatmap
    renderAttackHeatMap() {
        const data = this.dashboard.getCurrentData();
        if (!data.attack_timing || !data.attack_timing.timeline_heatmap) return;

        const heatmapData = data.attack_timing.timeline_heatmap;
        const heatmapContainer = document.getElementById('attackHeatmap');
        
        const dates = new Set();
        Object.values(heatmapData).forEach(hourData => {
            Object.keys(hourData).forEach(date => dates.add(date));
        });
        const sortedDates = Array.from(dates).sort();

        let html = '<div class="heatmap-grid">';
        html += '<div class="heatmap-header">';
        html += '<div class="heatmap-cell hour-label"></div>';
        
        sortedDates.forEach(date => {
            const displayDate = new Date(date).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric'
            });
            html += `<div class="heatmap-cell date-label">${displayDate}</div>`;
        });
        html += '</div>';

        let maxValue = 0;
        for (let hour = 0; hour < 24; hour++) {
            const hourData = heatmapData[hour] || {};
            Object.values(hourData).forEach(count => {
                maxValue = Math.max(maxValue, count);
            });
        }

        for (let hour = 0; hour < 24; hour++) {
            html += '<div class="heatmap-row">';
            
            const hourLabel = `${hour.toString().padStart(2, '0')}:00`;
            html += `<div class="heatmap-cell hour-label">${hourLabel}</div>`;
            
            sortedDates.forEach(date => {
                const hourData = heatmapData[hour] || {};
                const value = hourData[date] || 0;
                const intensity = maxValue > 0 ? value / maxValue : 0;
                
                const backgroundColor = this.getHeatmapColor(intensity);
                
                html += `
                    <div class="heatmap-cell data-cell" 
                         style="background-color: ${backgroundColor}"
                         title="Date: ${date}\nHour: ${hourLabel}\nAttacks: ${value}">
                        ${value || ''}
                    </div>`;
            });
            
            html += '</div>';
        }
        html += '</div>';

        html += `
            <div class="heatmap-legend">
                <span class="legend-label">Attack Intensity:</span>
                <div class="legend-gradient"></div>
                <span class="legend-max">Max: ${maxValue} attacks</span>
            </div>`;

        heatmapContainer.innerHTML = html;
    }
    
    // Helper Methods
    createGradient(ctx, color1, color2) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, color2);
        return gradient;
    }
    
    getHeatmapColor(intensity) {
        if (intensity === 0) return '#ffffff';
        
        const red = Math.round(239 + (255 - 239) * (1 - intensity));
        const green = Math.round(68 + (255 - 68) * (1 - intensity));
        const blue = Math.round(68 + (255 - 68) * (1 - intensity));
        const alpha = 0.1 + (intensity * 0.9);
        
        return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }
    
    processUsernameStats(failedLogins, successfulLogins) {
        const usernameStats = {};
        
        Object.entries(failedLogins).forEach(([username, count]) => {
            usernameStats[username] = usernameStats[username] || { failed: 0, successful: 0 };
            usernameStats[username].failed = count;
        });
        
        Object.entries(successfulLogins).forEach(([username, count]) => {
            usernameStats[username] = usernameStats[username] || { failed: 0, successful: 0 };
            usernameStats[username].successful = count;
        });
        
        return usernameStats;
    }
    
    renderEmptyChart(ctx, message) {
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['No Data'],
                datasets: [{
                    label: 'Count',
                    data: [0],
                    backgroundColor: '#e2e8f0',
                    borderColor: '#cbd5e1',
                    borderWidth: 1,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: message,
                        color: '#64748b'
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#64748b' }
                    },
                    y: {
                        beginAtZero: true,
                        max: 1,
                        grid: { color: '#e2e8f0' },
                        ticks: { color: '#64748b' }
                    }
                }
            }
        });
    }
    
    // Chart Options Methods
    getTimelineChartOptions(dates) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                title: { display: false },
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        title: (context) => {
                            const originalDate = dates[context[0].dataIndex];
                            const d = new Date(originalDate);
                            return `Date: ${d.toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                            })}`;
                        },
                        label: (context) => `Sessions: ${context.parsed.y}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: '#e2e8f0', drawBorder: false },
                    ticks: { color: '#64748b', font: { size: 12 }, maxRotation: 45 }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: '#e2e8f0', drawBorder: false },
                    ticks: { 
                        color: '#64748b', 
                        font: { size: 12 },
                        callback: function(value) {
                            return Number.isInteger(value) ? value : null;
                        }
                    }
                }
            },
            animation: { duration: 1500, easing: 'easeOutQuart' },
            elements: { point: { hoverRadius: 8 } }
        };
    }
    
    getBarChartOptions(title, dangerousCmds = null) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: false },
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        title: (context) => dangerousCmds ? 
                            `Command: ${dangerousCmds[context[0].dataIndex][0]}` : 
                            `IP: ${context[0].label}`,
                        label: (context) => dangerousCmds ? 
                            `Usage: ${context.parsed.y} times` : 
                            `Connections: ${context.parsed.y}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748b', font: { size: 12 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: '#e2e8f0' },
                    ticks: { color: '#64748b', font: { size: 12 } }
                }
            },
            animation: { duration: 1000, easing: 'easeOutQuart' }
        };
    }
    
    getFailedLoginsChartOptions(sortedUsernames) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                title: { display: false },
                legend: {
                    display: true,
                    position: 'top',
                    labels: { usePointStyle: true, padding: 20, font: { size: 12 } }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    cornerRadius: 8,
                    callbacks: {
                        title: (context) => `Username: ${context[0].label}`,
                        label: (context) => {
                            const username = sortedUsernames[context.dataIndex];
                            const total = username.failed + username.successful;
                            const successRate = total > 0 ? ((username.successful / total) * 100).toFixed(1) : 0;
                            
                            if (context.datasetIndex === 0) {
                                return `Failed: ${context.parsed.y} attempts`;
                            } else {
                                return `Successful: ${context.parsed.y} (${successRate}% success rate)`;
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748b', font: { size: 11 }, maxRotation: 45 }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: '#e2e8f0' },
                    ticks: { color: '#64748b', font: { size: 11 } }
                }
            },
            animation: { duration: 1000, easing: 'easeOutQuart' }
        };
    }
    
    getDoughnutChartOptions(total) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                title: { display: false },
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { usePointStyle: true, padding: 20, font: { size: 12 } }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    cornerRadius: 8,
                    callbacks: {
                        label: (context) => {
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${context.parsed} (${percentage}%)`;
                        }
                    }
                }
            },
            animation: { duration: 1500, easing: 'easeOutQuart' }
        };
    }
    
    getLineChartOptions(title) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: false },
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#8b5cf6',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        title: (context) => `Password Length: ${context[0].label}`,
                        label: (context) => `Count: ${context.parsed.y} passwords`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: '#e2e8f0' },
                    ticks: { color: '#64748b', font: { size: 11 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: '#e2e8f0' },
                    ticks: { color: '#64748b', font: { size: 11 } }
                }
            },
            animation: { duration: 1000, easing: 'easeOutQuart' }
        };
    }
    
    getPatternChartOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '50%',
            plugins: {
                title: { display: false },
                legend: {
                    display: true,
                    position: 'right',
                    labels: { usePointStyle: true, padding: 15, font: { size: 11 } }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#8b5cf6',
                    borderWidth: 1,
                    cornerRadius: 8,
                    callbacks: {
                        label: (context) => {
                            const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${context.parsed} (${percentage}%)`;
                        }
                    }
                }
            },
            animation: { duration: 1500, easing: 'easeOutQuart' }
        };
    }
    
    getHorizontalBarChartOptions(title) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                title: { display: false },
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#8b5cf6',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        title: (context) => `Password: "${context[0].label}"`,
                        label: (context) => `Used ${context.parsed.x} times`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: '#e2e8f0' },
                    ticks: { color: '#64748b', font: { size: 11 } }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#64748b', font: { size: 11 } }
                }
            },
            animation: { duration: 1000, easing: 'easeOutQuart' }
        };
    }
    
    getHourlyChartOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    callbacks: {
                        title: (context) => `Time: ${context[0].label}`,
                        label: (context) => `Attacks: ${context.parsed.y}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { maxRotation: 45, color: '#64748b' }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: '#e2e8f0' },
                    ticks: { color: '#64748b' }
                }
            }
        };
    }
    
    getWeeklyChartOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    callbacks: {
                        title: (context) => context[0].label,
                        label: (context) => `Attacks: ${context.parsed.y}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748b' }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: '#e2e8f0' },
                    ticks: { color: '#64748b' }
                }
            }
        };
    }
}