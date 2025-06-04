// modules/map-renderer.js - Handle world map rendering
export class MapRenderer {
    constructor(dashboard) {
        this.dashboard = dashboard;
    }
    
    renderWorldMap() {
        const data = this.dashboard.getCurrentData();
        if (!data || !data.geo_data) return;
        
        // Destroy existing map
        if (this.dashboard.getMap()) {
            this.dashboard.getMap().remove();
        }
        
        // Initialize map
        const map = L.map('worldMap').setView([20, 0], 2);
        
        // Add tile layer with dark theme
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 10
        }).addTo(map);
        
        const geoData = data.geo_data;
        const topIPs = data.top_ips;
        
        // Calculate attack intensity for color coding
        const maxAttacks = Math.max(...Object.values(topIPs));
        
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
                }).addTo(map);
                
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
                    this.setStyle({ weight: 3, fillOpacity: 1 });
                });
                
                marker.on('mouseout', function() {
                    this.setStyle({ weight: 2, fillOpacity: 0.8 });
                });
            }
        });
        
        // Fit map to show all markers
        if (Object.keys(geoData).length > 0) {
            const group = new L.featureGroup();
            map.eachLayer(layer => {
                if (layer instanceof L.CircleMarker) {
                    group.addLayer(layer);
                }
            });
            
            if (group.getLayers().length > 0) {
                map.fitBounds(group.getBounds().pad(0.1));
            }
        }
        
        this.dashboard.setMap(map);
    }
}