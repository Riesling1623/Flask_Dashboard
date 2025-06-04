// modules/event-handler.js - Handle all event listeners
export class EventHandler {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }
    
    setupEventListeners() {
        // Date range and data loading
        document.getElementById('loadData').addEventListener('click', () => this.dashboard.loadData());
        
        // Filters and search
        document.getElementById('ipFilter').addEventListener('change', () => this.dashboard.tableManager.filterSessions());
        document.getElementById('searchInput').addEventListener('input', () => this.dashboard.tableManager.filterSessions());
        
        // Export functionality
        document.getElementById('exportExcel').addEventListener('click', () => this.dashboard.tableManager.exportToExcel());
        
        // Pagination
        document.getElementById('prevPage').addEventListener('click', () => this.dashboard.tableManager.previousPage());
        document.getElementById('nextPage').addEventListener('click', () => this.dashboard.tableManager.nextPage());
        
        // Modal events
        this.setupModalEvents();
        
        // Keyboard shortcuts
        this.setupKeyboardShortcuts();
    }
    
    setupModalEvents() {
        const modal = document.getElementById('detailModal');
        const closeBtn = document.querySelector('.modal-close');
        
        // Close modal when clicking X
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.dashboard.tableManager.closeModal());
        }
        
        // Close modal when clicking outside
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                this.dashboard.tableManager.closeModal();
            }
        });
        
        // Close modal with Escape key
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modal.style.display === 'block') {
                this.dashboard.tableManager.closeModal();
            }
        });
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Ctrl/Cmd + Enter to load data
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                this.dashboard.loadData();
            }
            
            // Ctrl/Cmd + E to export Excel
            if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
                event.preventDefault();
                this.dashboard.tableManager.exportToExcel();
            }
            
            // Arrow keys for pagination (when not in input fields)
            if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) {
                if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    this.dashboard.tableManager.previousPage();
                } else if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    this.dashboard.tableManager.nextPage();
                }
            }
        });
    }
}