// modules/table-manager.js - Handle table operations and modal
export class TableManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }
    
    renderTable() {
        const data = this.dashboard.getCurrentData();
        if (!data || !data.sessions) return;

        this.dashboard.updateFilteredSessions([...data.sessions]);
        this.dashboard.setCurrentPage(1);
        this.updateTable();
    }
    
    updateTable() {
        const tbody = document.querySelector('#sessionTable tbody');
        const startIndex = (this.dashboard.getCurrentPage() - 1) * this.dashboard.getItemsPerPage();
        const endIndex = startIndex + this.dashboard.getItemsPerPage();
        const pageData = this.dashboard.getFilteredSessions().slice(startIndex, endIndex);

        tbody.innerHTML = '';
        
        pageData.forEach(session => {
            const row = this.createTableRow(session);
            tbody.appendChild(row);
        });

        this.updatePagination();
    }
    
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
    }
    
    createClickableCount(session, type) {
        const count = Array.isArray(session[type]) ? session[type].length : 0;
        
        if (count > 0) {
            return `<span class="clickable-count" onclick="window.showDetails('${session.session_id}', '${type}')">${count}</span>`;
        }
        return count.toString();
    }
    
    getStatusClass(status) {
        const statusLower = status.toLowerCase();
        if (statusLower === 'success') return 'status-success';
        if (statusLower === 'failed' || statusLower === 'failure') return 'status-failed';
        return '';
    }
    
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    formatTimestamp(timestamp) {
        if (!timestamp) return 'N/A';
        
        try {
            const date = new Date(timestamp);
            return date.toLocaleString();
        } catch (e) {
            return timestamp;
        }
    }
    
    setupFilters() {
        const data = this.dashboard.getCurrentData();
        if (!data || !data.sessions) return;

        const ipFilter = document.getElementById('ipFilter');
        const uniqueIPs = this.dashboard.dataManager.getUniqueIPs(data.sessions);
        
        ipFilter.innerHTML = '<option value="all">All IPs</option>';
        uniqueIPs.forEach(ip => {
            const option = document.createElement('option');
            option.value = ip;
            option.textContent = ip;
            ipFilter.appendChild(option);
        });
    }
    
    filterSessions() {
        const data = this.dashboard.getCurrentData();
        if (!data || !data.sessions) return;

        const ipFilter = document.getElementById('ipFilter').value;
        const searchInput = document.getElementById('searchInput').value;

        const filteredSessions = this.dashboard.dataManager.filterSessions(
            data.sessions, 
            ipFilter, 
            searchInput
        );

        this.dashboard.updateFilteredSessions(filteredSessions);
        this.dashboard.setCurrentPage(1);
        this.updateTable();
    }
    
    showDetails(sessionId, detailType) {
        const data = this.dashboard.getCurrentData();
        const session = data.sessions.find(s => s.session_id === sessionId);
        if (!session) return;

        const modal = document.getElementById('detailModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');

        const { title, items } = this.getDetailData(session, sessionId, detailType);

        modalTitle.innerHTML = title;
        modalContent.innerHTML = this.renderDetailContent(items);
        
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
    
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
    }
    
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
    }
    
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
    }
    
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
    
    closeModal() {
        const modal = document.getElementById('detailModal');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
    
    updatePagination() {
        const totalPages = Math.ceil(this.dashboard.getFilteredSessions().length / this.dashboard.getItemsPerPage());
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        
        pageInfo.textContent = `Page ${this.dashboard.getCurrentPage()} of ${totalPages}`;
        prevBtn.disabled = this.dashboard.getCurrentPage() === 1;
        nextBtn.disabled = this.dashboard.getCurrentPage() === totalPages;
    }
    
    previousPage() {
        if (this.dashboard.getCurrentPage() > 1) {
            this.dashboard.setCurrentPage(this.dashboard.getCurrentPage() - 1);
            this.updateTable();
        }
    }
    
    nextPage() {
        const totalPages = Math.ceil(this.dashboard.getFilteredSessions().length / this.dashboard.getItemsPerPage());
        if (this.dashboard.getCurrentPage() < totalPages) {
            this.dashboard.setCurrentPage(this.dashboard.getCurrentPage() + 1);
            this.updateTable();
        }
    }
    
    exportToExcel() {
        const data = this.dashboard.getCurrentData();
        if (!data || !data.sessions) return;

        const excelData = this.dashboard.dataManager.prepareExcelData(data.sessions);

        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'SSH Honeypot Data');
        
        const { startDate, endDate } = this.dashboard.uiManager.getDateRange();
        const filename = `ssh_honeypot_${startDate}_to_${endDate}.xlsx`;
        
        XLSX.writeFile(wb, filename);
        
        this.dashboard.uiManager.showNotification('Excel file exported successfully!', 'success');
    }
}