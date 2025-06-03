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
            timeline: null  // New: timeline chart
        }
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
            this.renderCharts();
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
    
    // Render charts with modern styling
    renderCharts() {
        if (!this.data.currentData) return;

        this.destroyExistingCharts();
        this.renderTimelineChart();  // New: render timeline chart first
        this.renderTopIPsChart();
        this.renderDangerousCommandsChart();
    },
    
    // Destroy existing charts to prevent memory leaks
    destroyExistingCharts() {
        Object.values(this.data.charts).forEach(chart => {
            if (chart) {
                chart.destroy();
            }
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