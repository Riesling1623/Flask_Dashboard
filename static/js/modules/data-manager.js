// modules/data-manager.js - Handle all data operations

export class DataManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }
    
    // Validate date range input
    validateDateRange(startDate, endDate) {
        if (!startDate || !endDate) {
            this.dashboard.uiManager.showError('Please select both start and end dates');
            return false;
        }

        if (new Date(startDate) > new Date(endDate)) {
            this.dashboard.uiManager.showError('Start date cannot be after end date');
            return false;
        }
        
        return true;
    }
    
    // Fetch analysis data from API
    async fetchAnalysisData(startDate, endDate) {
        const startDateStr = startDate.replace(/-/g, '');
        const endDateStr = endDate.replace(/-/g, '');
        
        const response = await fetch(`/api/analysis?start_date=${startDateStr}&end_date=${endDateStr}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    }
    
    // Process and format session data
    processSessionData(sessions) {
        return sessions.map(session => ({
            ...session,
            formattedTimestamp: this.formatTimestamp(session.timestamp),
            commandCount: Array.isArray(session.commands) ? session.commands.length : 0,
            dangerousCount: Array.isArray(session.dangerous_commands) ? session.dangerous_commands.length : 0,
            downloadsCount: Array.isArray(session.downloads) ? session.downloads.length : 0
        }));
    }
    
    // Format timestamp for display
    formatTimestamp(timestamp) {
        if (!timestamp) return 'N/A';
        
        try {
            const date = new Date(timestamp);
            return date.toLocaleString();
        } catch (e) {
            return timestamp;
        }
    }
    
    // Get statistics summary
    getStatsSummary(data) {
        if (!data) return null;
        
        const stats = data.statistics || {};
        const dangerousCommands = data.dangerous_commands || {};
        
        return {
            totalSessions: stats.total_sessions || 0,
            uniqueIPs: stats.unique_ips || 0,
            dangerousCommands: Object.keys(dangerousCommands).length,
            totalCommands: stats.total_commands || 0
        };
    }
    
    // Filter sessions based on criteria
    filterSessions(sessions, ipFilter, searchInput) {
        return sessions.filter(session => {
            const matchesIP = ipFilter === 'all' || session.ip_address === ipFilter;
            const matchesSearch = !searchInput || 
                (session.session_id && session.session_id.toLowerCase().includes(searchInput.toLowerCase())) ||
                (session.username && session.username.toLowerCase().includes(searchInput.toLowerCase())) ||
                (session.commands && session.commands.some(cmd => cmd.toLowerCase().includes(searchInput.toLowerCase())));

            return matchesIP && matchesSearch;
        });
    }
    
    // Get unique IP addresses
    getUniqueIPs(sessions) {
        return [...new Set(sessions.map(s => s.ip_address))].filter(ip => ip);
    }
    
    // Export data to Excel format
    prepareExcelData(sessions) {
        return sessions.map(session => ({
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
    }
}