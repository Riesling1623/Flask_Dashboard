// dashboard.js - Main dashboard application

import { Utils } from './utils.js';
import { ApiService } from './apiService.js';
import { ChartManager } from './chartManager.js';
// import { PasswordCharts } from './passwordCharts.js';
import { MapManager } from './mapManager.js';
import { TableManager } from './tableManager.js';
import { ExportManager } from './exportManager.js';

// Modern Dashboard JavaScript - Main Application
const DashboardApp = {
    data: {
        currentData: null,
    },
    
    // Initialize managers
    chartManager: null,
    // passwordCharts: null,
    mapManager: null,
    tableManager: null,
    
    // Initialize the application
    init() {
        this.initializeManagers();
        this.setupEventListeners();
        this.initializeDates();
        console.log('Dashboard initialized');
    },
    
    // Initialize all managers
    initializeManagers() {
        this.chartManager = new ChartManager();
        // this.passwordCharts = new PasswordCharts(this.chartManager);
        this.mapManager = new MapManager();
        this.tableManager = new TableManager();
        
        // Make table manager globally accessible for onclick handlers
        window.tableManager = this.tableManager;
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
        document.getElementById('prevPage').addEventListener('click', () => this.tableManager.previousPage());
        document.getElementById('nextPage').addEventListener('click', () => this.tableManager.nextPage());
        
        // Modal events
        this.setupModalEvents();
    },
    
    // Setup modal event listeners
    setupModalEvents() {
        const modal = document.getElementById('detailModal');
        const closeBtn = document.querySelector('.modal-close');
        
        // Close modal when clicking X
        closeBtn.addEventListener('click', () => this.tableManager.closeModal());
        
        // Close modal when clicking outside
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                this.tableManager.closeModal();
            }
        });
        
        // Close modal with Escape key
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modal.style.display === 'block') {
                this.tableManager.closeModal();
            }
        });
    },
    
    // Initialize date inputs with default values
    initializeDates() {
        const dates = Utils.initializeDates();
        document.getElementById('startDate').value = dates.startDate;
        document.getElementById('endDate').value = dates.endDate;
    },
    
    // Load data based on selected date range
    async loadData() {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const dashboardContent = document.getElementById('dashboardContent');

        // Validation
        const validation = Utils.validateDateRange(startDate, endDate);
        if (!validation.valid) {
            Utils.showError(validation.error);
            return;
        }

        // Show loading state
        Utils.setLoadingState(true);
        document.getElementById('error').textContent = '';
        dashboardContent.style.display = 'none';

        try {
            const data = await ApiService.fetchAnalysisData(startDate, endDate);
            
            if (data.error) {
                throw new Error(data.error);
            }

            this.data.currentData = data;
            Utils.setLoadingState(false);
            dashboardContent.style.display = 'block';
            dashboardContent.classList.add('fade-in');
            
            // Render all components
            this.updateHeaderStats();
            this.mapManager.renderWorldMap(data.geo_data, data.top_ips);
            this.renderCharts();
            this.renderCredentialAnalysis();
            this.tableManager.renderTable(data.sessions);
            this.tableManager.setupFilters(data.sessions);
            
        } catch (err) {
            Utils.setLoadingState(false);
            Utils.showError(`Error loading data: ${err.message}`);
            console.error('Error:', err);
        }
    },
    
    // Update header statistics
    updateHeaderStats() {
        if (!this.data.currentData) return;
        
        const stats = this.data.currentData.statistics || {};
        const dangerousCommands = this.data.currentData.dangerous_commands || {};
        
        // Animate counter updates
        Utils.animateCounter('totalSessionsStat', stats.total_sessions || 0);
        Utils.animateCounter('uniqueIPsStat', stats.unique_ips || 0);
        Utils.animateCounter('dangerousCommandsStat', Object.keys(dangerousCommands).length);
    },
    
    // Render all charts
    renderCharts() {
        if (!this.data.currentData) return;

        this.chartManager.destroyAllCharts();
        
        // Render timeline chart
        this.chartManager.renderTimelineChart(this.data.currentData.daily_sessions || {});
        
        // Render basic charts
        this.chartManager.renderTopIPsChart(this.data.currentData.top_ips || {});
        this.chartManager.renderDangerousCommandsChart(this.data.currentData.dangerous_commands || {});
        
        // Render failed logins chart
        this.chartManager.renderFailedLoginsChart(
            this.data.currentData.failed_logins || {},
            this.data.currentData.successful_logins || {}
        );
    },
    
    // Render credential analysis charts
    renderCredentialAnalysis() {
        if (!this.data.currentData) return;
        
        const failedLogins = this.data.currentData.failed_logins || {};
        const successfulLogins = this.data.currentData.successful_logins || {};
        // const passwordAnalysis = this.data.currentData.password_analysis;
        
        // Render login ratio chart
        // this.passwordCharts.renderLoginRatioChart(failedLogins, successfulLogins);
        
        // Render password analysis charts
        // if (passwordAnalysis) {
        //     this.passwordCharts.renderPasswordLengthChart(passwordAnalysis);
        //     this.passwordCharts.renderPasswordPatternsChart(passwordAnalysis);
        //     this.passwordCharts.renderTopPasswordsChart(passwordAnalysis);
        // }
    },
    
    // Filter sessions
    filterSessions() {
        if (!this.data.currentData || !this.data.currentData.sessions) return;
        this.tableManager.filterSessions(this.data.currentData.sessions);
    },
    
    // Export to Excel
    exportToExcel() {
        if (!this.data.currentData || !this.data.currentData.sessions) return;
        ExportManager.exportToExcel(this.data.currentData.sessions);
    }
};

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    DashboardApp.init();
});

// Make showDetails globally accessible for onclick handlers
window.showDetails = (sessionId, detailType) => {
    if (window.tableManager && DashboardApp.data.currentData) {
        window.tableManager.showDetails(sessionId, detailType, DashboardApp.data.currentData.sessions);
    }
};