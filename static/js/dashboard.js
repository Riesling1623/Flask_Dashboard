// Modern Dashboard JavaScript - dashboard.js

// Application state
const DashboardApp = {
    data: {
        currentData: null,
        currentPage: 1,
        itemsPerPage: 10,
        filteredSessions: [],
        charts: {
            topIPs: null,
            dangerousCommands: null,
            timeline: null,
            failedLogins: null,
            loginRatio: null,
            passwordLength: null,
            passwordPatterns: null,
            topPasswords: null,
            // hourlyAttacks: null,
            // weeklyAttacks: null
        },
        map: null  // New: Leaflet map instance
    },
    
    // Initialize the application
    init() {
        this.setupEventListeners();
        this.initializeDates();
        console.log('Dashboard initialized');
    },
    
    // Setup all event listeners
    setupEventListeners() {
        // Date range and data loading
        document.getElementById('loadData').addEventListener('click', () => this.loadData());
        
        // Filters and search
        document.getElementById('ipFilter').addEventListener('change', () => this.filterSessions());
        document.getElementById('searchInput').addEventListener('input', () => this.filterSessions());
        
        // Export functionality
        document.getElementById('exportExcel').addEventListener('click', () => this.exportToExcel());
        
        // Pagination
        document.getElementById('prevPage').addEventListener('click', () => this.previousPage());
        document.getElementById('nextPage').addEventListener('click', () => this.nextPage());
        
        // Modal events
        this.setupModalEvents();
    },
    
    // Setup modal event listeners
    setupModalEvents() {
        const modal = document.getElementById('detailModal');
        const closeBtn = document.querySelector('.modal-close');
        
        // Close modal when clicking X
        closeBtn.addEventListener('click', () => this.closeModal());
        
        // Close modal when clicking outside
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                this.closeModal();
            }
        });
        
        // Close modal with Escape key
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modal.style.display === 'block') {
                this.closeModal();
            }
        });
    },
    
    // Initialize date inputs with default values
    initializeDates() {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        document.getElementById('startDate').value = yesterday.toISOString().split('T')[0];
        document.getElementById('endDate').value = today.toISOString().split('T')[0];
    },
    
    // Load data based on selected date range
    async loadData() {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');
        const dashboardContent = document.getElementById('dashboardContent');

        // Validation
        if (!this.validateDateRange(startDate, endDate)) {
            return;
        }

        // Show loading state
        this.setLoadingState(true);
        error.textContent = '';
        dashboardContent.style.display = 'none';

        try {
            const data = await this.fetchAnalysisData(startDate, endDate);
            
            if (data.error) {
                throw new Error(data.error);
            }

            this.data.currentData = data;
            this.setLoadingState(false);
            dashboardContent.style.display = 'block';
            dashboardContent.classList.add('fade-in');
            
            // Render all components
            this.updateHeaderStats();
            this.renderWorldMap();     // render world map first
            this.renderCharts();
            // this.renderAttackTimingAnalysis();
            this.renderTable();
            this.setupFilters();
        } catch (err) {
            this.setLoadingState(false);
            this.showError(`Error loading data: ${err.message}`);
            console.error('Error:', err);
        }
    },
    
    // Validate date range input
    validateDateRange(startDate, endDate) {
        const error = document.getElementById('error');
        
        if (!startDate || !endDate) {
            this.showError('Please select both start and end dates');
            return false;
        }

        if (new Date(startDate) > new Date(endDate)) {
            this.showError('Start date cannot be after end date');
            return false;
        }
        
        return true;
    },
    
    // Fetch analysis data from API
    async fetchAnalysisData(startDate, endDate) {
        const startDateStr = startDate.replace(/-/g, '');
        const endDateStr = endDate.replace(/-/g, '');
        
        const response = await fetch(`/api/analysis?start_date=${startDateStr}&end_date=${endDateStr}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    },
    
    // Update header statistics
    updateHeaderStats() {
        if (!this.data.currentData) return;
        
        const stats = this.data.currentData.statistics || {};
        const dangerousCommands = this.data.currentData.dangerous_commands || {};
        
        // Animate counter updates
        this.animateCounter('totalSessionsStat', stats.total_sessions || 0);
        this.animateCounter('uniqueIPsStat', stats.unique_ips || 0);
        this.animateCounter('dangerousCommandsStat', Object.keys(dangerousCommands).length);
    },
    
    // Animate counter numbers
    animateCounter(elementId, targetValue) {
        const element = document.querySelector(`#${elementId} .stat-number`);
        const startValue = parseInt(element.textContent) || 0;
        const duration = 1000; // 1 second
        const startTime = performance.now();
        
        const updateCounter = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function for smooth animation
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentValue = Math.floor(startValue + (targetValue - startValue) * easeOut);
            
            element.textContent = currentValue.toLocaleString();
            
            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            }
        };
        
        requestAnimationFrame(updateCounter);
    },
    
    // Render World Map with attack origins
    renderWorldMap() {
        if (!this.data.currentData || !this.data.currentData.geo_data) return;
        
        // Destroy existing map
        if (this.data.map) {
            this.data.map.remove();
        }
        
        // Initialize map
        this.data.map = L.map('worldMap').setView([20, 0], 2);
        
        // Add tile layer with dark theme
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 10
        }).addTo(this.data.map);
        
        const geoData = this.data.currentData.geo_data;
        const topIPs = this.data.currentData.top_ips;
        
        // Calculate attack intensity for color coding
        const maxAttacks = Math.max(...Object.values(topIPs));
        
        // Group attacks by country for summary
        const countryStats = {};
        
        // Add markers for each IP
        Object.entries(geoData).forEach(([ip, location]) => {
            if (location.latitude && location.longitude && ip in topIPs) {
                const attackCount = topIPs[ip];
                const intensity = attackCount / maxAttacks;
                
                // Determine marker color based on intensity
                let color = '#10b981'; // Low - green
                if (intensity > 0.7) color = '#ef4444'; // High - red
                else if (intensity > 0.3) color = '#f59e0b'; // Medium - orange
                
                // Determine marker size based on attack count
                const radius = Math.max(8, Math.min(25, attackCount * 3));
                
                // Create custom marker
                const marker = L.circleMarker([location.latitude, location.longitude], {
                    color: '#ffffff',
                    weight: 2,
                    fillColor: color,
                    fillOpacity: 0.8,
                    radius: radius
                }).addTo(this.data.map);
                
                // Create popup content with geolocation info
                const popupContent = `
                    <div class="popup-content">
                        <h4><i class="fas fa-globe"></i> ${ip}</h4>
                        <p><strong>Country:</strong> ${location.country}</p>
                        <p><strong>City:</strong> ${location.city}</p>
                        <p><strong>ISP:</strong> ${location.isp}</p>
                        <p><strong>Region:</strong> ${location.region}</p>
                        <p class="attack-count"><strong>Attacks:</strong> ${attackCount}</p>
                    </div>
                `;
                
                marker.bindPopup(popupContent, {
                    maxWidth: 300,
                    className: 'custom-popup'
                });
                
                // Add hover effects
                marker.on('mouseover', function() {
                    this.setStyle({
                        weight: 3,
                        fillOpacity: 1
                    });
                });
                
                marker.on('mouseout', function() {
                    this.setStyle({
                        weight: 2,
                        fillOpacity: 0.8
                    });
                });
                
                // Aggregate by country
                const country = location.country;
                if (!countryStats[country]) {
                    countryStats[country] = {
                        attacks: 0,
                        ips: 0
                    };
                }
                countryStats[country].attacks += attackCount;
                countryStats[country].ips += 1;
            }
        });
        
        // Add country summary in console for debugging
        console.log('Attack summary by country:', countryStats);
        
        // Fit map to show all markers
        if (Object.keys(geoData).length > 0) {
            const group = new L.featureGroup();
            this.data.map.eachLayer(layer => {
                if (layer instanceof L.CircleMarker) {
                    group.addLayer(layer);
                }
            });
            
            if (group.getLayers().length > 0) {
                this.data.map.fitBounds(group.getBounds().pad(0.1));
            }
        }
    },
    
    // Render charts with modern styling
    renderCharts() {
        if (!this.data.currentData) return;

        this.destroyExistingCharts();
        this.renderTimelineChart();  // render timeline chart first
        this.renderTopIPsChart();
        this.renderDangerousCommandsChart();
        this.renderCredentialAnalysisCharts();  // render credential analysis
        // this.renderAttackTimingAnalysis();
    },
    
    // Destroy existing charts to prevent memory leaks
    destroyExistingCharts() {
        // Object.values(this.data.charts).forEach(chart => {
        //     if (chart) {
        //         chart.destroy();
        //     }
        // });
        const chartIds = [
            'timelineChart',
            'topIPsChart', 
            'dangerousCommandsChart',
            'failedLoginsChart',
            'loginRatioChart',
            'passwordLengthChart',
            'passwordPatternsChart',
            'topPasswordsChart',
            // 'hourlyAttacksChart',    // Add these new charts
            // 'weeklyAttacksChart'     // Add these new charts
        ];

        // Destroy each chart if it exists
        chartIds.forEach(id => {
            const canvas = document.getElementById(id);
            if (canvas) {
                const chartInstance = Chart.getChart(canvas);
                if (chartInstance) {
                    chartInstance.destroy();
                }
            }
        });

        // Reset chart references in data object
        Object.keys(this.data.charts).forEach(key => {
            this.data.charts[key] = null;
        });
    },
    
    // Render Timeline Chart (Sessions per Day)
    renderTimelineChart() {
        const dailySessions = this.data.currentData.daily_sessions || {};
        const dates = Object.keys(dailySessions).sort();
        
        // Only show timeline chart if there are 2 or more days
        const timelineContainer = document.getElementById('timelineChartContainer');
        if (dates.length < 2) {
            timelineContainer.style.display = 'none';
            return;
        }
        
        timelineContainer.style.display = 'block';
        
        const ctx = document.getElementById('timelineChart').getContext('2d');
        const sessionCounts = dates.map(date => dailySessions[date]);
        
        // Format dates for display
        const formattedDates = dates.map(date => {
            const d = new Date(date);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
        
        this.data.charts.timeline = new Chart(ctx, {
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
                    pointHoverRadius: 8,
                    pointHoverBackgroundColor: '#1d4ed8',
                    pointHoverBorderColor: '#ffffff',
                    pointHoverBorderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        display: false
                    },
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
                        grid: {
                            color: '#e2e8f0',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#64748b',
                            font: {
                                size: 12
                            },
                            maxRotation: 45
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#e2e8f0',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#64748b',
                            font: {
                                size: 12
                            },
                            callback: function(value) {
                                return Number.isInteger(value) ? value : null;
                            }
                        }
                    }
                },
                animation: {
                    duration: 1500,
                    easing: 'easeOutQuart'
                },
                elements: {
                    point: {
                        hoverRadius: 8
                    }
                }
            }
        });
    },
    
    // Render Credential Analysis Charts
    renderCredentialAnalysisCharts() {
        this.renderFailedLoginsChart();
        this.renderLoginRatioChart();
        this.renderPasswordAnalysisCharts();  // Add password analysis
    },
    
    // Render Failed Logins Chart
    renderFailedLoginsChart() {
        const failedLogins = this.data.currentData.failed_logins || {};
        const successfulLogins = this.data.currentData.successful_logins || {};
        
        // Get top 10 usernames by total attempts (failed + successful)
        const usernameStats = {};
        
        // Combine failed and successful attempts
        Object.entries(failedLogins).forEach(([username, count]) => {
            usernameStats[username] = usernameStats[username] || { failed: 0, successful: 0 };
            usernameStats[username].failed = count;
        });
        
        Object.entries(successfulLogins).forEach(([username, count]) => {
            usernameStats[username] = usernameStats[username] || { failed: 0, successful: 0 };
            usernameStats[username].successful = count;
        });
        
        // Sort by total attempts and take top 10
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
        
        this.data.charts.failedLogins = new Chart(ctx, {
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
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: {
                                size: 12
                            }
                        }
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
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#64748b',
                            font: {
                                size: 11
                            },
                            maxRotation: 45
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#e2e8f0'
                        },
                        ticks: {
                            color: '#64748b',
                            font: {
                                size: 11
                            }
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    },
    
    // Render Login Ratio Pie Chart
    renderLoginRatioChart() {
        const failedLogins = this.data.currentData.failed_logins || {};
        const successfulLogins = this.data.currentData.successful_logins || {};
        
        const totalFailed = Object.values(failedLogins).reduce((sum, count) => sum + count, 0);
        const totalSuccessful = Object.values(successfulLogins).reduce((sum, count) => sum + count, 0);
        const total = totalFailed + totalSuccessful;
        
        if (total === 0) {
            this.renderEmptyChart(document.getElementById('loginRatioChart').getContext('2d'), 'No login data available');
            return;
        }
        
        const ctx = document.getElementById('loginRatioChart').getContext('2d');
        
        this.data.charts.loginRatio = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Failed Attempts', 'Successful Logins'],
                datasets: [{
                    data: [totalFailed, totalSuccessful],
                    backgroundColor: [
                        '#ef4444',  // Red for failed
                        '#10b981'   // Green for successful
                    ],
                    borderColor: [
                        '#dc2626',
                        '#059669'
                    ],
                    borderWidth: 3,
                    hoverBorderWidth: 4,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: {
                                size: 12
                            }
                        }
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
                animation: {
                    duration: 1500,
                    easing: 'easeOutQuart'
                }
            }
        });
    },
    
    // Render Password Analysis Charts
    renderPasswordAnalysisCharts() {
        this.renderPasswordLengthChart();
        this.renderPasswordPatternsChart();
        this.renderTopPasswordsChart();
    },
    
    // Render Password Length Distribution Chart
    renderPasswordLengthChart() {
        const passwordAnalysis = this.data.currentData.password_analysis;
        if (!passwordAnalysis || !passwordAnalysis.length_distribution) {
            this.renderEmptyChart(document.getElementById('passwordLengthChart').getContext('2d'), 'No password data available');
            return;
        }
        
        const lengthData = passwordAnalysis.length_distribution;
        const sortedLengths = Object.entries(lengthData)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .slice(0, 15); // Show up to 15 different lengths
        
        const ctx = document.getElementById('passwordLengthChart').getContext('2d');
        
        this.data.charts.passwordLength = new Chart(ctx, {
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
                    pointHoverRadius: 7,
                    pointHoverBackgroundColor: '#7c3aed',
                    pointHoverBorderColor: '#ffffff',
                    pointHoverBorderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        display: false
                    },
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
                        grid: {
                            color: '#e2e8f0'
                        },
                        ticks: {
                            color: '#64748b',
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#e2e8f0'
                        },
                        ticks: {
                            color: '#64748b',
                            font: {
                                size: 11
                            }
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    },
    
    // Render Password Patterns Chart
    renderPasswordPatternsChart() {
        const passwordAnalysis = this.data.currentData.password_analysis;
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
            'numeric_only': '#ef4444',      // Red
            'alpha_only': '#f59e0b',        // Orange
            'alphanumeric': '#10b981',      // Green
            'special_chars': '#3b82f6',     // Blue
            'empty': '#6b7280',             // Gray
            'common_weak': '#dc2626'        // Dark Red
        };
        
        const filteredPatterns = Object.entries(patterns).filter(([, count]) => count > 0);
        
        const ctx = document.getElementById('passwordPatternsChart').getContext('2d');
        
        this.data.charts.passwordPatterns = new Chart(ctx, {
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
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '50%',
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        display: true,
                        position: 'right',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: {
                                size: 11
                            }
                        }
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
                animation: {
                    duration: 1500,
                    easing: 'easeOutQuart'
                }
            }
        });
    },
    
    // Render Top Passwords Chart
    renderTopPasswordsChart() {
        const passwordAnalysis = this.data.currentData.password_analysis;
        if (!passwordAnalysis || !passwordAnalysis.top_passwords) {
            this.renderEmptyChart(document.getElementById('topPasswordsChart').getContext('2d'), 'No password data available');
            return;
        }
        
        const topPasswords = Object.entries(passwordAnalysis.top_passwords)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10); // Top 10 passwords
        
        if (topPasswords.length === 0) {
            this.renderEmptyChart(document.getElementById('topPasswordsChart').getContext('2d'), 'No password data available');
            return;
        }
        
        const ctx = document.getElementById('topPasswordsChart').getContext('2d');
        
        this.data.charts.topPasswords = new Chart(ctx, {
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
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // Horizontal bar chart
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        display: false
                    },
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
                        grid: {
                            color: '#e2e8f0'
                        },
                        ticks: {
                            color: '#64748b',
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#64748b',
                            font: {
                                size: 11
                            }
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    },
    
    // Render Top IPs chart
    renderTopIPsChart() {
        const topIPs = Object.entries(this.data.currentData.top_ips || {})
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        const ctx = document.getElementById('topIPsChart').getContext('2d');
        
        this.data.charts.topIPs = new Chart(ctx, {
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
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#3b82f6',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            title: (context) => `IP: ${context[0].label}`,
                            label: (context) => `Connections: ${context.parsed.y}`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#64748b',
                            font: {
                                size: 12
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#e2e8f0'
                        },
                        ticks: {
                            color: '#64748b',
                            font: {
                                size: 12
                            }
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    },
    
    // Render Dangerous Commands chart
    renderDangerousCommandsChart() {
        const dangerousCmds = Object.entries(this.data.currentData.dangerous_commands || {})
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        const ctx = document.getElementById('dangerousCmdChart').getContext('2d');
        
        if (dangerousCmds.length > 0) {
            this.data.charts.dangerousCommands = new Chart(ctx, {
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
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: false
                        },
                        legend: {
                            display: false
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: '#ef4444',
                            borderWidth: 1,
                            cornerRadius: 8,
                            displayColors: false,
                            callbacks: {
                                title: (context) => {
                                    const fullCmd = dangerousCmds[context[0].dataIndex][0];
                                    return `Command: ${fullCmd}`;
                                },
                                label: (context) => `Usage: ${context.parsed.y} times`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: '#64748b',
                                font: {
                                    size: 12
                                }
                            }
                        },
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: '#e2e8f0'
                            },
                            ticks: {
                                color: '#64748b',
                                font: {
                                    size: 12
                                }
                            }
                        }
                    },
                    animation: {
                        duration: 1000,
                        easing: 'easeOutQuart'
                    }
                }
            });
        } else {
            this.renderEmptyChart(ctx, 'No dangerous commands detected');
        }
    },

    // Render Attack Timing Analysis
    // renderAttackTimingAnalysis() {
    //     if (!this.data.currentData || !this.data.currentData.attack_timing) return;
        
    //     this.renderHourlyAttacksChart();
    //     this.renderWeeklyAttacksChart();
    //     this.renderAttackHeatmap();
    // },

    // Render Hourly Attacks Distribution
    // renderHourlyAttacksChart() {
    //     const hourlyData = this.data.currentData.attack_timing.hourly_distribution || {};
    //     const hours = Array.from({length: 24}, (_, i) => i);
    //     const attackCounts = hours.map(hour => hourlyData[hour] || 0);
        
    //     const ctx = document.getElementById('hourlyAttacksChart').getContext('2d');
        
    //     this.data.charts.hourlyAttacks = new Chart(ctx, {
    //         type: 'bar',
    //         data: {
    //             labels: hours.map(hour => `${String(hour).padStart(2, '0')}:00`),
    //             datasets: [{
    //                 label: 'Number of Attacks',
    //                 data: attackCounts,
    //                 backgroundColor: this.createGradient(ctx, '#f59e0b', '#d97706'),
    //                 borderColor: '#f59e0b',
    //                 borderWidth: 2,
    //                 borderRadius: 6
    //             }]
    //         },
    //         options: {
    //             responsive: true,
    //             maintainAspectRatio: false,
    //             plugins: {
    //                 legend: {
    //                     display: false
    //                 },
    //                 tooltip: {
    //                     backgroundColor: 'rgba(0, 0, 0, 0.8)',
    //                     callbacks: {
    //                         title: (context) => `Hour: ${context[0].label}`,
    //                         label: (context) => `Attacks: ${context.parsed.y}`
    //                     }
    //                 }
    //             },
    //             scales: {
    //                 x: {
    //                     grid: {
    //                         display: false
    //                     },
    //                     title: {
    //                         display: true,
    //                         text: 'Hour of Day (24h)',
    //                         color: '#64748b'
    //                     }
    //                 },
    //                 y: {
    //                     beginAtZero: true,
    //                     grid: {
    //                         color: '#e2e8f0'
    //                     },
    //                     title: {
    //                         display: true,
    //                         text: 'Number of Attacks',
    //                         color: '#64748b'
    //                     }
    //                 }
    //             }
    //         }
    //     });
    // },

    // // Render Weekly Attacks Distribution
    // renderWeeklyAttacksChart() {
    //     const weeklyData = this.data.currentData.attack_timing.daily_distribution || {};
    //     const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    //     const attackCounts = daysOfWeek.map((_, index) => weeklyData[index] || 0);
        
    //     const ctx = document.getElementById('weeklyAttacksChart').getContext('2d');
        
    //     this.data.charts.weeklyAttacks = new Chart(ctx, {
    //         type: 'line',
    //         data: {
    //             labels: daysOfWeek,
    //             datasets: [{
    //                 label: 'Number of Attacks',
    //                 data: attackCounts,
    //                 borderColor: '#f59e0b',
    //                 backgroundColor: this.createGradient(ctx, 'rgba(245, 158, 11, 0.2)', 'rgba(245, 158, 11, 0.05)'),
    //                 fill: true,
    //                 tension: 0.4,
    //                 pointBackgroundColor: '#f59e0b',
    //                 pointBorderColor: '#ffffff',
    //                 pointBorderWidth: 2,
    //                 pointRadius: 6
    //             }]
    //         },
    //         options: {
    //             responsive: true,
    //             maintainAspectRatio: false,
    //             plugins: {
    //                 legend: {
    //                     display: false
    //                 },
    //                 tooltip: {
    //                     backgroundColor: 'rgba(0, 0, 0, 0.8)',
    //                     callbacks: {
    //                         title: (context) => context[0].label,
    //                         label: (context) => `Attacks: ${context.parsed.y}`
    //                     }
    //                 }
    //             },
    //             scales: {
    //                 x: {
    //                     grid: {
    //                         display: false
    //                     }
    //                 },
    //                 y: {
    //                     beginAtZero: true,
    //                     grid: {
    //                         color: '#e2e8f0'
    //                     }
    //                 }
    //             }
    //         }
    //     });
    // },

    // // Render Attack Heatmap
    // renderAttackHeatmap() {
    //     const heatmapData = this.data.currentData.attack_timing.timeline_heatmap;
    //     if (!heatmapData) return;

    //     const container = document.getElementById('attackHeatmap');
    //     const dates = Object.keys(Object.values(heatmapData)[0] || {}).sort();
        
    //     // Find max value for color scaling
    //     const maxAttacks = Math.max(
    //         ...Object.values(heatmapData).map(hourData => 
    //             Math.max(...Object.values(hourData))
    //         )
    //     );

    //     // Create heatmap grid
    //     let html = '<div class="heatmap-grid">';
        
    //     // Add header row with dates
    //     html += '<div class="heatmap-header">';
    //     html += '<div class="heatmap-cell hour-label"></div>'; // Empty corner cell
    //     dates.forEach(date => {
    //         const displayDate = new Date(date).toLocaleDateString('en-US', {
    //             month: 'short',
    //             day: 'numeric'
    //         });
    //         html += `<div class="heatmap-cell date-label">${displayDate}</div>`;
    //     });
    //     html += '</div>';

    //     // Add hour rows
    //     for (let hour = 0; hour < 24; hour++) {
    //         html += '<div class="heatmap-row">';
    //         html += `<div class="heatmap-cell hour-label">${String(hour).padStart(2, '0')}:00</div>`;
            
    //         dates.forEach(date => {
    //             const attacks = heatmapData[hour]?.[date] || 0;
    //             const intensity = attacks / maxAttacks;
    //             const backgroundColor = this.getHeatmapColor(intensity);
    //             html += `
    //                 <div class="heatmap-cell data-cell" 
    //                     style="background-color: ${backgroundColor}"
    //                     title="${attacks} attacks at ${hour}:00 on ${date}">
    //                     ${attacks}
    //                 </div>`;
    //         });
    //         html += '</div>';
    //     }
    //     html += '</div>';

    //     // Add legend
    //     html += `
    //         <div class="heatmap-legend">
    //             <span class="legend-label">Attack Intensity:</span>
    //             <div class="legend-gradient"></div>
    //             <span class="legend-max">Max: ${maxAttacks} attacks</span>
    //         </div>`;

    //     container.innerHTML = html;
    // },

    // Utility function for heatmap color generation
    // getHeatmapColor(intensity) {
    //     // Returns a color from green (low) to red (high)
    //     const hue = ((1 - intensity) * 120).toString(10);
    //     return `hsla(${hue}, 100%, 50%, ${0.1 + intensity * 0.9})`;
    // },
    
    // Create gradient for charts
    createGradient(ctx, color1, color2) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, color2);
        return gradient;
    },
    
    // Render empty chart placeholder
    renderEmptyChart(ctx, message) {
        this.data.charts.dangerousCommands = new Chart(ctx, {
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
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#64748b'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        max: 1,
                        grid: {
                            color: '#e2e8f0'
                        },
                        ticks: {
                            color: '#64748b'
                        }
                    }
                }
            }
        });
    },
    
    // Render sessions table
    renderTable() {
        if (!this.data.currentData || !this.data.currentData.sessions) return;

        this.data.filteredSessions = [...this.data.currentData.sessions];
        this.data.currentPage = 1;
        this.updateTable();
    },
    
    // Update table content
    updateTable() {
        const tbody = document.querySelector('#sessionTable tbody');
        const startIndex = (this.data.currentPage - 1) * this.data.itemsPerPage;
        const endIndex = startIndex + this.data.itemsPerPage;
        const pageData = this.data.filteredSessions.slice(startIndex, endIndex);

        tbody.innerHTML = '';
        
        pageData.forEach(session => {
            const row = this.createTableRow(session);
            tbody.appendChild(row);
        });

        this.updatePagination();
    },
    
    // Create table row element
    createTableRow(session) {
        const row = document.createElement('tr');
        
        // Format login status
        const statusText = session.login_status || 'N/A';
        const statusClass = this.getStatusClass(statusText);
        
        // Format clickable counts
        const commandsDisplay = this.createClickableCount(session, 'commands');
        const dangerousDisplay = this.createClickableCount(session, 'dangerous_commands');
        const downloadsDisplay = this.createClickableCount(session, 'downloads');
        
        row.innerHTML = `
            <td title="${session.session_id}">${this.truncateText(session.session_id || 'N/A', 12)}</td>
            <td>${session.ip_address || 'N/A'}</td>
            <td>${session.username || 'N/A'}</td>
            <td title="${session.password}">${this.truncateText(session.password || 'N/A', 15)}</td>
            <td><span class="${statusClass}">${statusText}</span></td>
            <td>${commandsDisplay}</td>
            <td>${dangerousDisplay}</td>
            <td>${downloadsDisplay}</td>
            <td title="${session.timestamp}">${this.formatTimestamp(session.timestamp)}</td>
        `;
        
        return row;
    },
    
    // Create clickable count element
    createClickableCount(session, type) {
        const count = Array.isArray(session[type]) ? session[type].length : 0;
        
        if (count > 0) {
            return `<span class="clickable-count" onclick="DashboardApp.showDetails('${session.session_id}', '${type}')">${count}</span>`;
        }
        return count.toString();
    },
    
    // Get CSS class for login status
    getStatusClass(status) {
        const statusLower = status.toLowerCase();
        if (statusLower === 'success') return 'status-success';
        if (statusLower === 'failed' || statusLower === 'failure') return 'status-failed';
        return '';
    },
    
    // Truncate text with ellipsis
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    },
    
    // Format timestamp for display
    formatTimestamp(timestamp) {
        if (!timestamp) return 'N/A';
        
        try {
            const date = new Date(timestamp);
            return date.toLocaleString();
        } catch (e) {
            return timestamp;
        }
    },
    
    // Setup filter options
    setupFilters() {
        if (!this.data.currentData || !this.data.currentData.sessions) return;

        const ipFilter = document.getElementById('ipFilter');
        const uniqueIPs = [...new Set(this.data.currentData.sessions.map(s => s.ip_address))];
        
        ipFilter.innerHTML = '<option value="all">All IPs</option>';
        uniqueIPs.forEach(ip => {
            if (ip) {
                const option = document.createElement('option');
                option.value = ip;
                option.textContent = ip;
                ipFilter.appendChild(option);
            }
        });
    },
    
    // Filter sessions based on criteria
    filterSessions() {
        if (!this.data.currentData || !this.data.currentData.sessions) return;

        const ipFilter = document.getElementById('ipFilter').value;
        const searchInput = document.getElementById('searchInput').value.toLowerCase();

        this.data.filteredSessions = this.data.currentData.sessions.filter(session => {
            const matchesIP = ipFilter === 'all' || session.ip_address === ipFilter;
            const matchesSearch = !searchInput || 
                (session.session_id && session.session_id.toLowerCase().includes(searchInput)) ||
                (session.username && session.username.toLowerCase().includes(searchInput)) ||
                (session.commands && session.commands.some(cmd => cmd.toLowerCase().includes(searchInput)));

            return matchesIP && matchesSearch;
        });

        this.data.currentPage = 1;
        this.updateTable();
    },
    
    // Show session details modal
    showDetails(sessionId, detailType) {
        const session = this.data.currentData.sessions.find(s => s.session_id === sessionId);
        if (!session) return;

        const modal = document.getElementById('detailModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');

        const { title, items } = this.getDetailData(session, sessionId, detailType);

        modalTitle.innerHTML = title;
        modalContent.innerHTML = this.renderDetailContent(items);
        
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    },
    
    // Get detail data for modal
    getDetailData(session, sessionId, detailType) {
        const typeConfig = {
            commands: {
                title: `<i class="fas fa-terminal"></i> Commands for Session ${sessionId}`,
                items: session.commands || []
            },
            dangerous_commands: {
                title: `<i class="fas fa-exclamation-triangle"></i> Dangerous Commands for Session ${sessionId}`,
                items: session.dangerous_commands || []
            },
            downloads: {
                title: `<i class="fas fa-download"></i> Downloads for Session ${sessionId}`,
                items: session.downloads || []
            }
        };
        
        return typeConfig[detailType] || { title: 'Unknown', items: [] };
    },
    
    // Render detail content for modal
    renderDetailContent(items) {
        if (items.length === 0) {
            return '<p style="text-align: center; color: #64748b; font-style: italic;">No items found.</p>';
        }

        let content = '<div class="detail-list">';
        items.forEach((item, index) => {
            const displayText = this.formatDetailItem(item);
            content += `<div class="detail-item">
                <strong>${index + 1}:</strong> ${displayText}
            </div>`;
        });
        content += '</div>';
        
        return content;
    },
    
    // Format individual detail item
    formatDetailItem(item) {
        if (typeof item === 'string') {
            return this.escapeHtml(item);
        } else if (typeof item === 'object' && item !== null) {
            if (item.url) {
                const filename = item.filename ? ` (File: ${item.filename})` : '';
                return `<strong>URL:</strong> ${this.escapeHtml(item.url)}${filename}`;
            }
            return `<pre>${JSON.stringify(item, null, 2)}</pre>`;
        }
        return String(item);
    },
    
    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    },
    
    // Close modal
    closeModal() {
        const modal = document.getElementById('detailModal');
        modal.style.display = 'none';
        document.body.style.overflow = ''; // Restore scrolling
    },
    
    // Pagination methods
    updatePagination() {
        const totalPages = Math.ceil(this.data.filteredSessions.length / this.data.itemsPerPage);
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        
        pageInfo.textContent = `Page ${this.data.currentPage} of ${totalPages}`;
        prevBtn.disabled = this.data.currentPage === 1;
        nextBtn.disabled = this.data.currentPage === totalPages;
    },
    
    previousPage() {
        if (this.data.currentPage > 1) {
            this.data.currentPage--;
            this.updateTable();
        }
    },
    
    nextPage() {
        const totalPages = Math.ceil(this.data.filteredSessions.length / this.data.itemsPerPage);
        if (this.data.currentPage < totalPages) {
            this.data.currentPage++;
            this.updateTable();
        }
    },
    
    // Export to Excel
    exportToExcel() {
        if (!this.data.currentData || !this.data.currentData.sessions) return;

        const data = this.data.currentData.sessions.map(session => ({
            'Session ID': session.session_id || '',
            'IP Address': session.ip_address || '',
            'Username': session.username || '',
            'Password': session.password || '',
            'Login Status': session.login_status || '',
            'Commands Count': Array.isArray(session.commands) ? session.commands.length : 0,
            'Dangerous Commands Count': Array.isArray(session.dangerous_commands) ? session.dangerous_commands.length : 0,
            'Downloads Count': Array.isArray(session.downloads) ? session.downloads.length : 0,
            'Timestamp': session.timestamp || ''
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'SSH Honeypot Data');
        
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const filename = `ssh_honeypot_${startDate}_to_${endDate}.xlsx`;
        
        XLSX.writeFile(wb, filename);
        
        // Show success notification
        this.showNotification('Excel file exported successfully!', 'success');
    },
    
    // Utility methods
    setLoadingState(isLoading) {
        const loading = document.getElementById('loading');
        loading.style.display = isLoading ? 'flex' : 'none';
    },
    
    showError(message) {
        const error = document.getElementById('error');
        error.textContent = message;
        error.style.display = 'block';
        
        // Auto-hide error after 5 seconds
        setTimeout(() => {
            error.style.display = 'none';
        }, 5000);
    },
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
        `;
        
        // Add to DOM
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
};

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    DashboardApp.init();
});

// Make showDetails globally accessible for onclick handlers
window.showDetails = (sessionId, detailType) => {
    DashboardApp.showDetails(sessionId, detailType);
};