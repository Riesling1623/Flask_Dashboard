from flask import Flask, render_template, jsonify, request
from datetime import datetime, timedelta
import json
import os
from collections import Counter, defaultdict
import glob
import requests
import time
from functools import lru_cache
import random

app = Flask(__name__)

# Mock geolocation data for testing
MOCK_GEO_DATA = {
    '8.8.8.8': {'country': 'United States', 'country_code': 'US', 'city': 'Mountain View', 'region': 'California', 'latitude': 37.4056, 'longitude': -122.0775, 'isp': 'Google LLC', 'timezone': 'America/Los_Angeles'},
    '1.1.1.1': {'country': 'Australia', 'country_code': 'AU', 'city': 'Sydney', 'region': 'New South Wales', 'latitude': -33.8688, 'longitude': 151.2093, 'isp': 'Cloudflare Inc', 'timezone': 'Australia/Sydney'},
    '208.67.222.222': {'country': 'United States', 'country_code': 'US', 'city': 'San Francisco', 'region': 'California', 'latitude': 37.7749, 'longitude': -122.4194, 'isp': 'OpenDNS LLC', 'timezone': 'America/Los_Angeles'},
    '185.228.168.9': {'country': 'Russia', 'country_code': 'RU', 'city': 'Moscow', 'region': 'Moscow', 'latitude': 55.7558, 'longitude': 37.6176, 'isp': 'Yandex LLC', 'timezone': 'Europe/Moscow'},
    '114.114.114.114': {'country': 'China', 'country_code': 'CN', 'city': 'Beijing', 'region': 'Beijing', 'latitude': 39.9042, 'longitude': 116.4074, 'isp': 'China Telecom', 'timezone': 'Asia/Shanghai'},
    '203.0.113.1': {'country': 'Japan', 'country_code': 'JP', 'city': 'Tokyo', 'region': 'Tokyo', 'latitude': 35.6762, 'longitude': 139.6503, 'isp': 'NTT Communications', 'timezone': 'Asia/Tokyo'},
    '80.80.80.80': {'country': 'Germany', 'country_code': 'DE', 'city': 'Berlin', 'region': 'Berlin', 'latitude': 52.5200, 'longitude': 13.4050, 'isp': 'Deutsche Telekom', 'timezone': 'Europe/Berlin'},
    '9.9.9.9': {'country': 'United Kingdom', 'country_code': 'GB', 'city': 'London', 'region': 'England', 'latitude': 51.5074, 'longitude': -0.1278, 'isp': 'Quad9', 'timezone': 'Europe/London'},
    '208.67.220.220': {'country': 'Canada', 'country_code': 'CA', 'city': 'Toronto', 'region': 'Ontario', 'latitude': 43.6532, 'longitude': -79.3832, 'isp': 'Rogers Communications', 'timezone': 'America/Toronto'},
    '77.88.8.8': {'country': 'France', 'country_code': 'FR', 'city': 'Paris', 'region': 'Île-de-France', 'latitude': 48.8566, 'longitude': 2.3522, 'isp': 'Orange S.A.', 'timezone': 'Europe/Paris'}
}

def generate_mock_ip():
    """Generate a random IP from our mock data"""
    return random.choice(list(MOCK_GEO_DATA.keys()))

@lru_cache(maxsize=1000)
def get_ip_location(ip_address):
    """Get IP geolocation with caching and mock data for testing"""
    
    # For testing: if it's a private IP, convert to mock public IP
    if (ip_address.startswith('192.168.') or 
        ip_address.startswith('10.') or 
        ip_address.startswith('172.') or
        ip_address == '127.0.0.1' or
        ip_address == 'localhost'):
        
        print(f"Converting private IP {ip_address} to mock data for testing")
        # Use the last octet to determine which mock IP to use
        try:
            last_octet = int(ip_address.split('.')[-1]) if '.' in ip_address else 1
            mock_ips = list(MOCK_GEO_DATA.keys())
            mock_ip = mock_ips[last_octet % len(mock_ips)]
            return MOCK_GEO_DATA[mock_ip].copy()
        except:
            return MOCK_GEO_DATA['8.8.8.8'].copy()
    
    # Use mock data if available
    if ip_address in MOCK_GEO_DATA:
        print(f"Using mock data for IP: {ip_address}")
        return MOCK_GEO_DATA[ip_address].copy()
    
    # Try real API for public IPs
    try:
        print(f"Fetching real geolocation for IP: {ip_address}")
        response = requests.get(f'https://ipapi.co/{ip_address}/json/', timeout=5)
        if response.status_code == 200:
            data = response.json()
            if 'error' not in data:
                return {
                    'country': data.get('country_name', 'Unknown'),
                    'country_code': data.get('country_code', 'UN'),
                    'city': data.get('city', 'Unknown'),
                    'region': data.get('region', 'Unknown'),
                    'latitude': data.get('latitude'),
                    'longitude': data.get('longitude'),
                    'isp': data.get('org', 'Unknown'),
                    'timezone': data.get('timezone', 'Unknown')
                }
    except Exception as e:
        print(f"Error getting location for {ip_address}: {e}")
    
    # Return random mock data as fallback
    return random.choice(list(MOCK_GEO_DATA.values())).copy()

def parse_timestamp(ts):
    return datetime.fromisoformat(ts.replace('Z', '+00:00'))

def get_available_dates():
    """Get list of available analysis dates from data folder"""
    files = glob.glob('data/analysis_*.json')
    dates = []
    for file in files:
        # Extract date from filename analysis_YYYYMMDD.json
        filename = os.path.basename(file)
        if filename.startswith('analysis_') and filename.endswith('.json'):
            date_str = filename[9:17]  # Extract YYYYMMDD
            try:
                date_obj = datetime.strptime(date_str, '%Y%m%d')
                dates.append(date_str)
            except ValueError:
                continue
    return sorted(dates)

def load_analysis_data(start_date, end_date):
    """Load and combine analysis data from date range"""
    combined_data = {
        'sessions': [],
        'statistics': {
            'total_sessions': 0,
            'unique_ips': 0
        },
        'top_ips': {},
        'dangerous_commands': {},
        'daily_sessions': {},
        'geo_data': {},  # New: geographical data
        'all_sessions': []
    }
    
    try:
        start_dt = datetime.strptime(start_date, '%Y%m%d')
        end_dt = datetime.strptime(end_date, '%Y%m%d')
        
        all_ips = set()
        top_ips_counter = Counter()
        dangerous_commands_counter = Counter()
        all_usernames_counter = Counter()
        daily_sessions_counter = Counter()
        geo_data = {}  # Store IP -> location mapping
        
        # Generate all dates in range
        current_dt = start_dt
        while current_dt <= end_dt:
            date_str = current_dt.strftime('%Y%m%d')
            file_path = f'data/analysis_{date_str}.json'
            
            # Initialize day with 0 sessions
            date_key = current_dt.strftime('%Y-%m-%d')
            daily_sessions_counter[date_key] = 0
            
            if os.path.exists(file_path):
                try:
                    with open(file_path, 'r', encoding='utf-8') as file:
                        data = json.load(file)
                    
                    # Process statistics
                    if 'statistics' in data:
                        sessions_count = data['statistics'].get('total_sessions', 0)
                        combined_data['statistics']['total_sessions'] += sessions_count
                        combined_data['statistics']['unique_ips'] += data['statistics'].get('unique_ips', 0)
                        
                        # Count sessions for this day
                        daily_sessions_counter[date_key] = sessions_count
                    
                    # Process top IPs and get geo data
                    if 'top_ips' in data:
                        for ip_data in data['top_ips']:
                            ip = ip_data['ip']
                            count = ip_data['count']
                            top_ips_counter[ip] += count
                            all_ips.add(ip)
                            
                            # Get geolocation for this IP
                            if ip not in geo_data:
                                print(f"Getting location for IP: {ip}")
                                geo_data[ip] = get_ip_location(ip)
                                # No rate limiting needed for mock data
                                if not any(ip.startswith(prefix) for prefix in ['192.168.', '10.', '172.', '127.']):
                                    time.sleep(0.1)  # Only rate limit real API calls
                    
                    # Process dangerous commands
                    if 'dangerous_commands' in data:
                        for cmd_data in data['dangerous_commands']:
                            if isinstance(cmd_data, dict) and 'command' in cmd_data and 'count' in cmd_data:
                                command = cmd_data['command']
                                count = cmd_data['count']
                                dangerous_commands_counter[command] += count
                    
                    # Process session details
                    if 'session_details' in data:
                        for session_id, session_data in data['session_details'].items():
                            # Convert to format expected by frontend
                            session = {
                                'session_id': session_id,
                                'ip_address': session_data.get('ip', ''),
                                'timestamp': session_data.get('timestamp', ''),
                                'username': session_data.get('login', {}).get('username', ''),
                                'password': session_data.get('login', {}).get('password', ''),
                                'login_status': session_data.get('login', {}).get('status', ''),
                                'commands': session_data.get('commands', []),
                                'dangerous_commands': session_data.get('dangerous_commands', []),
                                'downloads': session_data.get('downloads', [])
                            }
                            combined_data['sessions'].append(session)
                            combined_data['all_sessions'].append(session)
                            
                            # Count usernames
                            if session['username']:
                                all_usernames_counter[session['username']] += 1
                        
                except (json.JSONDecodeError, UnicodeDecodeError) as e:
                    print(f"Error reading {file_path}: {e}")
                    
            current_dt += timedelta(days=1)
        
        # Convert counters to the format expected by charts
        combined_data['top_ips'] = dict(top_ips_counter)
        combined_data['statistics']['unique_ips'] = len(all_ips)
        combined_data['top_usernames'] = dict(all_usernames_counter)
        combined_data['dangerous_commands'] = dict(dangerous_commands_counter)
        combined_data['daily_sessions'] = dict(daily_sessions_counter)
        combined_data['geo_data'] = geo_data  # Add geographical data
        
        # NEW: Analyze failed login attempts by username
        failed_logins_counter = Counter()
        successful_logins_counter = Counter()
        
        # NEW: Password analysis
        password_lengths = Counter()
        password_patterns = {
            'numeric_only': 0,          # 123456
            'alpha_only': 0,            # password
            'alphanumeric': 0,          # admin123
            'special_chars': 0,         # p@ssw0rd!
            'empty': 0,                 # (empty password)
            'common_weak': 0            # admin, root, password, etc.
        }
        common_passwords = Counter()
        
        # Define common weak passwords for detection
        weak_passwords = {
            'admin', 'root', 'password', '123456', '12345', 'qwerty', 
            'test', 'guest', '1234', 'administrator', 'user', 'login',
            '123', 'pass', 'default', 'toor', 'oracle', 'postgres',
            'mysql', 'ubuntu', 'centos', 'redhat', 'debian'
        }
        
        for session in combined_data['sessions']:
            username = session.get('username', 'unknown')
            password = session.get('password', '')
            login_status = session.get('login_status', '').lower()
            
            # Count login attempts
            if login_status == 'failed' or login_status == 'failure':
                failed_logins_counter[username] += 1
            elif login_status == 'success':
                successful_logins_counter[username] += 1
            
            # Analyze password patterns
            if password:
                # Password length analysis
                password_lengths[len(password)] += 1
                
                # Count occurrences of specific passwords
                common_passwords[password] += 1
                
                # Pattern analysis
                if password.isdigit():
                    password_patterns['numeric_only'] += 1
                elif password.isalpha():
                    password_patterns['alpha_only'] += 1
                elif password.isalnum():
                    password_patterns['alphanumeric'] += 1
                elif any(c in password for c in '!@#$%^&*()_+-=[]{}|;:,.<>?'):
                    password_patterns['special_chars'] += 1
                
                # Check for common weak passwords
                if password.lower() in weak_passwords:
                    password_patterns['common_weak'] += 1
            else:
                password_patterns['empty'] += 1
        
        combined_data['failed_logins'] = dict(failed_logins_counter)
        combined_data['successful_logins'] = dict(successful_logins_counter)
        
        # NEW: Add password analysis data
        combined_data['password_analysis'] = {
            'length_distribution': dict(password_lengths),
            'pattern_distribution': password_patterns,
            'top_passwords': dict(common_passwords.most_common(20))  # Top 20 most used passwords
        }
        
        # NEW: Attack timing analysis
        hourly_attacks = Counter()  # Hour (0-23) -> count
        daily_attacks = Counter()   # Day of week (0-6) -> count
        attack_timeline = {}        # Hour -> {date: count}
        
        for session in combined_data['sessions']:
            timestamp = session.get('timestamp', '')
            if timestamp:
                try:
                    # Parse timestamp
                    dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    
                    # Count attacks by hour (0-23)
                    hour = dt.hour
                    hourly_attacks[hour] += 1
                    
                    # Count attacks by day of week (0=Monday, 6=Sunday)
                    day_of_week = dt.weekday()
                    daily_attacks[day_of_week] += 1
                    
                    # Build timeline for heatmap (hour x date)
                    date_key = dt.strftime('%Y-%m-%d')
                    if hour not in attack_timeline:
                        attack_timeline[hour] = {}
                    attack_timeline[hour][date_key] = attack_timeline[hour].get(date_key, 0) + 1
                    
                except Exception as e:
                    print(f"Error parsing timestamp {timestamp}: {e}")
        
        combined_data['attack_timing'] = {
            'hourly_distribution': dict(hourly_attacks),
            'daily_distribution': dict(daily_attacks),
            'timeline_heatmap': attack_timeline
        }
        
        # Calculate total commands
        total_commands = sum(len(session['commands']) for session in combined_data['sessions'])
        combined_data['statistics']['total_commands'] = total_commands
            
    except ValueError as e:
        print(f"Date parsing error: {e}")
        return combined_data
    
    return combined_data

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/available-dates')
def available_dates():
    """Get available analysis dates"""
    dates = get_available_dates()
    return jsonify({'dates': dates})

@app.route('/api/analysis')
def analysis():
    """Get analysis data for date range"""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    # If no dates provided, try to load default analysis.json
    if not start_date or not end_date:
        try:
            with open('data/analysis.json', 'r', encoding='utf-8') as file:
                data = json.load(file)
            return jsonify(data)
        except FileNotFoundError:
            return jsonify({'error': 'No data available'}), 404
    
    # Validate date format
    try:
        datetime.strptime(start_date, '%Y%m%d')
        datetime.strptime(end_date, '%Y%m%d')
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYYMMDD'}), 400
    
    data = load_analysis_data(start_date, end_date)
    return jsonify(data)

@app.route('/api/session/<session_id>')
def get_session_details(session_id):
    """Get detailed information for a specific session"""
    # This endpoint can be used for future detailed session analysis
    # For now, return a placeholder
    return jsonify({
        'session_id': session_id,
        'detailed_info': 'Detailed session analysis coming soon'
    })

@app.errorhandler(404)
def not_found_error(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Create static directories if they don't exist
    static_dirs = ['static/css', 'static/js', 'static/images']
    for dir_path in static_dirs:
        os.makedirs(dir_path, exist_ok=True)
    
    # Create data directory if it doesn't exist
    os.makedirs('data', exist_ok=True)
    
    app.run(host="0.0.0.0", port=5000, debug=True)