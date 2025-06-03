from flask import Flask, render_template, jsonify, request
from datetime import datetime, timedelta
import json
import os
from collections import Counter, defaultdict
import glob

app = Flask(__name__)

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
        'daily_sessions': {},  # New: sessions per day
        'all_sessions': []
    }
    
    try:
        start_dt = datetime.strptime(start_date, '%Y%m%d')
        end_dt = datetime.strptime(end_date, '%Y%m%d')
        
        all_ips = set()
        top_ips_counter = Counter()
        dangerous_commands_counter = Counter()
        all_usernames_counter = Counter()
        daily_sessions_counter = Counter()  # New: count sessions per day
        
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
                    
                    # Process top IPs
                    if 'top_ips' in data:
                        for ip_data in data['top_ips']:
                            ip = ip_data['ip']
                            count = ip_data['count']
                            top_ips_counter[ip] += count
                            all_ips.add(ip)
                    
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
        combined_data['daily_sessions'] = dict(daily_sessions_counter)  # New: daily sessions data
        
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