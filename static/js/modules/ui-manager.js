// modules/ui-manager.js - Handle UI operations and animations
export class UIManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }
    
    initializeDates() {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        document.getElementById('startDate').value = yesterday.toISOString().split('T')[0];
        document.getElementById('endDate').value = today.toISOString().split('T')[0];
    }
    
    getDateRange() {
        return {
            startDate: document.getElementById('startDate').value,
            endDate: document.getElementById('endDate').value
        };
    }
    
    setLoadingState(isLoading) {
        const loading = document.getElementById('loading');
        loading.style.display = isLoading ? 'flex' : 'none';
    }
    
    showDashboardContent() {
        const dashboardContent = document.getElementById('dashboardContent');
        const error = document.getElementById('error');
        
        error.textContent = '';
        dashboardContent.style.display = 'block';
        dashboardContent.classList.add('fade-in');
    }
    
    showError(message) {
        const error = document.getElementById('error');
        error.textContent = message;
        error.style.display = 'block';
        
        // Auto-hide error after 5 seconds
        setTimeout(() => {
            error.style.display = 'none';
        }, 5000);
    }
    
    updateHeaderStats(data) {
        if (!data) return;
        
        const summary = this.dashboard.dataManager.getStatsSummary(data);
        
        // Animate counter updates
        this.animateCounter('totalSessionsStat', summary.totalSessions);
        this.animateCounter('uniqueIPsStat', summary.uniqueIPs);
        this.animateCounter('dangerousCommandsStat', summary.dangerousCommands);
    }
    
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
    }
    
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
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}