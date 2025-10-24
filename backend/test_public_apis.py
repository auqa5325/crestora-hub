#!/usr/bin/env python3
"""
Test script for public team APIs
This script demonstrates how to use the public APIs without authentication
"""

import requests
import json

# Base URL for the API
BASE_URL = "http://localhost:8000"

def test_public_apis():
    """Test all public team APIs"""
    
    print("🚀 Testing Crestora'25 Public Team APIs")
    print("=" * 50)
    
    # Test 1: Health Check
    print("\n1. Testing Public Health Check...")
    try:
        response = requests.get(f"{BASE_URL}/api/public/health")
        if response.status_code == 200:
            print("✅ Health check passed")
            print(f"   Response: {response.json()}")
        else:
            print(f"❌ Health check failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Health check error: {e}")
    
    # Test 2: Get Team Statistics
    print("\n2. Testing Team Statistics...")
    try:
        response = requests.get(f"{BASE_URL}/api/public/teams/stats")
        if response.status_code == 200:
            print("✅ Team stats retrieved successfully")
            stats = response.json()
            print(f"   Total teams: {stats.get('total_teams', 0)}")
            print(f"   Active teams: {stats.get('active_teams', 0)}")
        else:
            print(f"❌ Team stats failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Team stats error: {e}")
    
    # Test 3: Get All Teams
    print("\n3. Testing Get All Teams...")
    try:
        response = requests.get(f"{BASE_URL}/api/public/teams?limit=5")
        if response.status_code == 200:
            print("✅ Teams retrieved successfully")
            data = response.json()
            teams = data.get('teams', [])
            print(f"   Retrieved {len(teams)} teams")
            if teams:
                first_team = teams[0]
                print(f"   First team: {first_team.get('team_name', 'N/A')} ({first_team.get('team_id', 'N/A')})")
        else:
            print(f"❌ Get teams failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Get teams error: {e}")
    
    # Test 4: Get Specific Team (if teams exist)
    print("\n4. Testing Get Specific Team...")
    try:
        # First get a team ID
        response = requests.get(f"{BASE_URL}/api/public/teams?limit=1")
        if response.status_code == 200:
            data = response.json()
            teams = data.get('teams', [])
            if teams:
                team_id = teams[0].get('team_id')
                print(f"   Testing with team ID: {team_id}")
                
                # Now get specific team
                response = requests.get(f"{BASE_URL}/api/public/teams/{team_id}")
                if response.status_code == 200:
                    print("✅ Specific team retrieved successfully")
                    team_data = response.json()
                    print(f"   Team: {team_data.get('team_name', 'N/A')}")
                    print(f"   Members: {len(team_data.get('members', []))}")
                else:
                    print(f"❌ Get specific team failed: {response.status_code}")
            else:
                print("⚠️  No teams found to test with")
        else:
            print(f"❌ Could not get team list: {response.status_code}")
    except Exception as e:
        print(f"❌ Get specific team error: {e}")
    
    # Test 5: Get Team Scores (if teams exist)
    print("\n5. Testing Get Team Scores...")
    try:
        # First get a team ID
        response = requests.get(f"{BASE_URL}/api/public/teams?limit=1")
        if response.status_code == 200:
            data = response.json()
            teams = data.get('teams', [])
            if teams:
                team_id = teams[0].get('team_id')
                print(f"   Testing with team ID: {team_id}")
                
                # Now get team scores
                response = requests.get(f"{BASE_URL}/api/public/teams/{team_id}/scores")
                if response.status_code == 200:
                    print("✅ Team scores retrieved successfully")
                    scores_data = response.json()
                    scores = scores_data.get('scores', [])
                    print(f"   Total scores: {len(scores)}")
                else:
                    print(f"❌ Get team scores failed: {response.status_code}")
            else:
                print("⚠️  No teams found to test with")
        else:
            print(f"❌ Could not get team list: {response.status_code}")
    except Exception as e:
        print(f"❌ Get team scores error: {e}")
    
    # Test 6: Get Leaderboard
    print("\n6. Testing Get Leaderboard...")
    try:
        response = requests.get(f"{BASE_URL}/api/public/leaderboard?limit=10")
        if response.status_code == 200:
            print("✅ Leaderboard retrieved successfully")
            leaderboard_data = response.json()
            leaderboard = leaderboard_data.get('leaderboard', [])
            print(f"   Top {len(leaderboard)} teams in leaderboard")
            if leaderboard:
                top_team = leaderboard[0]
                print(f"   #1 Team: {top_team.get('team_name', 'N/A')} (Score: {top_team.get('final_score', 'N/A')})")
        else:
            print(f"❌ Get leaderboard failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Get leaderboard error: {e}")
    
    print("\n" + "=" * 50)
    print("🎉 Public API testing completed!")
    print("\n📋 Available Public Endpoints:")
    print("   GET /api/public/health - Health check")
    print("   GET /api/public/teams - Get all teams")
    print("   GET /api/public/teams/stats - Get team statistics")
    print("   GET /api/public/teams/{team_id} - Get specific team")
    print("   GET /api/public/teams/{team_id}/scores - Get team scores")
    print("   GET /api/public/leaderboard - Get leaderboard")

if __name__ == "__main__":
    test_public_apis()
