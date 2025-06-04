// dashboard-core.js - Main dashboard controller

import { DataManager } from './modules/data-manager.js';
import { ChartRenderer } from './modules/chart-renderer.js';
import { MapRenderer } from './modules/map-renderer.js';
import { TableManager } from './modules/table-manager.js';
import { UIManager } from './modules/ui-manager.js';
import { EventHandler } from './modules/event-handler.js';

class DashboardCore {
    constructor() {
        this.data = {
            currentData: null,
            currentPage: 1,
            itemsPerPage: 10,
            filteredSessions: [],
            charts: {},
            map: null
        };
        
        // Initialize modules
        this.dataManager = new DataManager(this);
        this.chartRenderer = new ChartRenderer(this);
        this.mapRenderer = new MapRenderer(this);
        this.tableManager = new TableManager(this);
        this.uiManager = new UIManager(this);
        this.eventHandler = new EventHandler(this);
    }
    
    // Initialize the application
    init() {
        this.eventHandler.setupEventListeners();
        this.uiManager.initializeDates();
        console.log('Dashboard initialized');
    }
    
    // Main data loading orchestrator
    async loadData() {
        const { startDate, endDate } = this.uiManager.getDateRange();
        
        if (!this.dataManager.validateDateRange(startDate, endDate)) {
            return;
        }

        this.uiManager.setLoadingState(true);
        
        try {
            const data = await this.dataManager.fetchAnalysisData(startDate, endDate);
            
            if (data.error) {
                throw new Error(data.error);
            }

            this.data.currentData = data;
            this.uiManager.setLoadingState(false);
            this.uiManager.showDashboardContent();
            
            // Render all components
            await this.renderAllComponents();
            
        } catch (err) {
            this.uiManager.setLoadingState(false);
            this.uiManager.showError(`Error loading data: ${err.message}`);
            console.error('Error:', err);
        }
    }
    
    // Render all dashboard components
    async renderAllComponents() {
        this.uiManager.updateHeaderStats(this.data.currentData);
        this.mapRenderer.renderWorldMap();
        this.chartRenderer.renderAllCharts();
        this.tableManager.renderTable();
        this.tableManager.setupFilters();
    }
    
    // Get current data
    getCurrentData() {
        return this.data.currentData;
    }
    
    // Update filtered sessions
    updateFilteredSessions(sessions) {
        this.data.filteredSessions = sessions;
    }
    
    // Get filtered sessions
    getFilteredSessions() {
        return this.data.filteredSessions;
    }
    
    // Pagination methods
    getCurrentPage() {
        return this.data.currentPage;
    }
    
    setCurrentPage(page) {
        this.data.currentPage = page;
    }
    
    getItemsPerPage() {
        return this.data.itemsPerPage;
    }
    
    // Chart management
    getChart(chartName) {
        return this.data.charts[chartName];
    }
    
    setChart(chartName, chartInstance) {
        this.data.charts[chartName] = chartInstance;
    }
    
    getAllCharts() {
        return this.data.charts;
    }
    
    // Map management
    getMap() {
        return this.data.map;
    }
    
    setMap(mapInstance) {
        this.data.map = mapInstance;
    }
}

// Global dashboard instance
window.DashboardApp = new DashboardCore();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.DashboardApp.init();
});

// Make showDetails globally accessible for onclick handlers
window.showDetails = (sessionId, detailType) => {
    window.DashboardApp.tableManager.showDetails(sessionId, detailType);
};