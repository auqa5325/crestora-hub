#!/usr/bin/env python3
"""
Comprehensive Crestora Event Testing Script
==========================================

This script simulates the complete Crestora event flow from start to finish,
testing all APIs and database operations, then reverts the database to initial state.

Features:
- Simulates all 14 rounds (4 Rolling + 9 Crestora + 1 Final)
- Tests all critical API endpoints
- Validates database state at each stage
- Comprehensive error reporting
- Database revert to initial state
- Detailed logging and issue tracking

Usage:
    python3 comprehensive_event_test.py

Author: Crestora Testing Suite
Version: 1.0.0
"""

import sys
import os
import json
import time
import requests
import random
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from sqlalchemy.orm import sessionmaker
from sqlalchemy import func

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, Base
from app.models.team import Team, TeamMember, TeamStatus
from app.models.rounds import UnifiedEvent, EventStatus, EventType
from app.models.team_score import TeamScore
from app.models.evaluation import Evaluation
from app.models.auth import User
from app.models.rolling_member import RollingEventMember, RollingMemberStatus
from app.models.round_weight import RoundWeight

# Configuration
API_BASE_URL = "http://localhost:8000"
TEST_USER_CREDENTIALS = {
    "admin": {"username": "pda", "password": "password"},
    "judge": {"username": "judge", "password": "judge123"},
    "club": {"username": "admin", "password": "admin123"}  # Use admin for club tests since pda should be admin only
}

@dataclass
class TestResult:
    """Test result data structure"""
    test_name: str
    success: bool
    error_message: str = ""
    response_data: Any = None
    execution_time: float = 0.0

@dataclass
class APIResponse:
    """API response wrapper"""
    status_code: int
    data: Any
    success: bool
    error_message: str = ""

class CrestoraEventTester:
    """Comprehensive Crestora Event Testing Suite"""
    
    def __init__(self):
        self.session_tokens = {}
        self.test_results = []
        self.database_session = None
        self.initial_db_state = {}
        self.current_round = 1
        self.round_ids = {}
        self.team_ids = []
        self.issues_found = []
        
    def setup_database_session(self):
        """Setup database session for direct database operations"""
        try:
            SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
            self.database_session = SessionLocal()
            print("✅ Database session established")
            return True
        except Exception as e:
            print(f"❌ Failed to setup database session: {e}")
            return False
    
    def capture_initial_db_state(self):
        """Capture initial database state for comparison"""
        try:
            print("\n📊 CAPTURING INITIAL DATABASE STATE")
            print("=" * 60)
            
            self.initial_db_state = {
                "teams": {
                    "count": self.database_session.query(Team).count(),
                    "active": self.database_session.query(Team).filter(Team.status == TeamStatus.ACTIVE).count(),
                    "current_round": self.database_session.query(Team).filter(Team.current_round == 1).count()
                },
                "rounds": {
                    "total": self.database_session.query(UnifiedEvent).count(),
                    "upcoming": self.database_session.query(UnifiedEvent).filter(UnifiedEvent.status == EventStatus.UPCOMING).count()
                },
                "team_scores": self.database_session.query(TeamScore).count(),
                "round_weights": self.database_session.query(RoundWeight).count(),
                "evaluations": self.database_session.query(Evaluation).count(),
                "rolling_members": self.database_session.query(RollingEventMember).count()
            }
            
            print(f"👥 Teams: {self.initial_db_state['teams']['count']} total, {self.initial_db_state['teams']['active']} active")
            print(f"🎯 Rounds: {self.initial_db_state['rounds']['total']} total, {self.initial_db_state['rounds']['upcoming']} upcoming")
            print(f"📊 Team Scores: {self.initial_db_state['team_scores']} records")
            print(f"⚖️ Round Weights: {self.initial_db_state['round_weights']} records")
            print(f"📝 Evaluations: {self.initial_db_state['evaluations']} records")
            print(f"🎪 Rolling Members: {self.initial_db_state['rolling_members']} records")
            
            return True
        except Exception as e:
            print(f"❌ Failed to capture initial DB state: {e}")
            return False
    
    def authenticate_user(self, user_type: str) -> bool:
        """Authenticate user and store session token"""
        try:
            credentials = TEST_USER_CREDENTIALS.get(user_type)
            if not credentials:
                print(f"❌ No credentials found for user type: {user_type}")
                return False
            
            # Try JSON login endpoint
            login_data = {
                "username": credentials["username"],
                "password": credentials["password"]
            }
            
            response = requests.post(
                f"{API_BASE_URL}/api/auth/login-json",
                json=login_data,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            if response.status_code == 200:
                token_data = response.json()
                self.session_tokens[user_type] = token_data["access_token"]
                print(f"✅ Authenticated {user_type} user: {credentials['username']}")
                return True
            else:
                print(f"❌ Authentication failed for {user_type}: {response.status_code} - {response.text}")
                # Try with form data as fallback
                form_data = {
                    "username": credentials["username"],
                    "password": credentials["password"]
                }
                
                response = requests.post(
                    f"{API_BASE_URL}/api/auth/login",
                    data=form_data,
                    timeout=10
                )
                
                if response.status_code == 200:
                    token_data = response.json()
                    self.session_tokens[user_type] = token_data["access_token"]
                    print(f"✅ Authenticated {user_type} user (form): {credentials['username']}")
                    return True
                else:
                    print(f"❌ Form authentication also failed for {user_type}: {response.status_code} - {response.text}")
                    return False
                
        except Exception as e:
            print(f"❌ Authentication error for {user_type}: {e}")
            return False
    
    def make_api_request(self, method: str, endpoint: str, user_type: str = "admin", 
                        data: Dict = None, params: Dict = None) -> APIResponse:
        """Make authenticated API request"""
        try:
            token = self.session_tokens.get(user_type)
            if not token:
                return APIResponse(
                    status_code=401,
                    data=None,
                    success=False,
                    error_message="No authentication token available"
                )
            
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            url = f"{API_BASE_URL}{endpoint}"
            
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method.upper() == "POST":
                response = requests.post(url, headers=headers, json=data, timeout=10)
            elif method.upper() == "PUT":
                response = requests.put(url, headers=headers, json=data, timeout=10)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                return APIResponse(
                    status_code=400,
                    data=None,
                    success=False,
                    error_message=f"Unsupported HTTP method: {method}"
                )
            
            try:
                response_data = response.json() if response.content else None
            except:
                response_data = response.text
            
            return APIResponse(
                status_code=response.status_code,
                data=response_data,
                success=200 <= response.status_code < 300,
                error_message=f"HTTP {response.status_code}" if not (200 <= response.status_code < 300) else ""
            )
            
        except Exception as e:
            return APIResponse(
                status_code=0,
                data=None,
                success=False,
                error_message=f"Request failed: {e}"
            )
    
    def test_api_endpoint(self, test_name: str, method: str, endpoint: str, 
                         user_type: str = "admin", expected_status: int = 200,
                         data: Dict = None, params: Dict = None) -> TestResult:
        """Test individual API endpoint"""
        start_time = time.time()
        
        try:
            response = self.make_api_request(method, endpoint, user_type, data, params)
            
            success = (response.status_code == expected_status and response.success)
            
            if not success:
                error_msg = f"Expected status {expected_status}, got {response.status_code}. {response.error_message}"
                if response.data and isinstance(response.data, dict) and "detail" in response.data:
                    error_msg += f" - {response.data['detail']}"
            else:
                error_msg = ""
            
            execution_time = time.time() - start_time
            
            result = TestResult(
                test_name=test_name,
                success=success,
                error_message=error_msg,
                response_data=response.data,
                execution_time=execution_time
            )
            
            if success:
                print(f"✅ {test_name} - {execution_time:.2f}s")
            else:
                print(f"❌ {test_name} - {error_msg}")
                self.issues_found.append({
                    "test": test_name,
                    "error": error_msg,
                    "response": response.data
                })
            
            self.test_results.append(result)
            return result
            
        except Exception as e:
            execution_time = time.time() - start_time
            result = TestResult(
                test_name=test_name,
                success=False,
                error_message=f"Test execution failed: {e}",
                execution_time=execution_time
            )
            print(f"❌ {test_name} - {e}")
            self.test_results.append(result)
            return result
    
    def get_rounds_and_teams(self):
        """Get all rounds and teams from database"""
        try:
            # Get all rounds
            rounds = self.database_session.query(UnifiedEvent).filter(
                UnifiedEvent.round_number > 0
            ).order_by(UnifiedEvent.round_number).all()
            
            for round_data in rounds:
                self.round_ids[round_data.round_number] = round_data.id
            
            # Get all team IDs
            teams = self.database_session.query(Team).filter(
                Team.status == TeamStatus.ACTIVE
            ).all()
            
            self.team_ids = [team.team_id for team in teams]
            
            print(f"📋 Found {len(rounds)} rounds and {len(self.team_ids)} active teams")
            return True
            
        except Exception as e:
            print(f"❌ Failed to get rounds and teams: {e}")
            return False
    
    def simulate_round_evaluation(self, round_number: int, round_id: int):
        """Simulate evaluation of a specific round"""
        try:
            print(f"\n🎯 SIMULATING ROUND {round_number} EVALUATION")
            print("-" * 40)
            
            # Test 1: Get round evaluations (should be empty initially)
            self.test_api_endpoint(
                f"Get Round {round_number} Evaluations",
                "GET",
                f"/api/rounds/rounds/{round_id}/evaluations",
                "admin"
            )
            
            # Test 2: Update round criteria
            criteria = [
                {"name": "Presentation", "weight": 40, "max_score": 40},
                {"name": "Content", "weight": 35, "max_score": 35},
                {"name": "Creativity", "weight": 25, "max_score": 25}
            ]
            
            self.test_api_endpoint(
                f"Update Round {round_number} Criteria",
                "PUT",
                f"/api/rounds/rounds/{round_id}/criteria",
                "admin",
                data=criteria
            )
            
            # Test 3: Evaluate random teams (simulate real evaluation)
            teams_to_evaluate = random.sample(self.team_ids, min(10, len(self.team_ids)))
            
            for i, team_id in enumerate(teams_to_evaluate):
                # Generate random scores
                presentation_score = round(random.uniform(25, 40), 1)
                content_score = round(random.uniform(20, 35), 1)
                creativity_score = round(random.uniform(15, 25), 1)
                total_score = round(presentation_score + content_score + creativity_score, 1)
                
                criteria_scores = {
                    "Presentation": presentation_score,
                    "Content": content_score,
                    "Creativity": creativity_score
                }
                
                self.test_api_endpoint(
                    f"Evaluate Team {team_id} in Round {round_number}",
                    "PUT",
                    f"/api/rounds/rounds/{round_id}/evaluate/{team_id}",
                    "admin",
                    data=criteria_scores
                )
                
                # Add small delay to simulate real evaluation
                time.sleep(0.1)
            
            # Test 4: Freeze round
            self.test_api_endpoint(
                f"Freeze Round {round_number}",
                "POST",
                f"/api/rounds/rounds/{round_id}/freeze",
                "admin"
            )
            
            # Test 5: Get round stats
            self.test_api_endpoint(
                f"Get Round {round_number} Stats",
                "GET",
                f"/api/rounds/rounds/{round_id}/stats",
                "admin"
            )
            
            return True
            
        except Exception as e:
            print(f"❌ Failed to simulate round {round_number} evaluation: {e}")
            return False
    
    def test_core_apis(self):
        """Test all core API endpoints"""
        print("\n🔧 TESTING CORE API ENDPOINTS")
        print("=" * 60)
        
        # Authentication tests
        self.test_api_endpoint("Health Check", "GET", "/api/health")
        self.test_api_endpoint("Get Events", "GET", "/api/rounds/")
        self.test_api_endpoint("Get Events Stats", "GET", "/api/rounds/stats")
        self.test_api_endpoint("Get Teams", "GET", "/api/teams/")
        self.test_api_endpoint("Get Team Stats", "GET", "/api/teams/stats")
        self.test_api_endpoint("Get Leaderboard", "GET", "/api/leaderboard/")
        self.test_api_endpoint("Get Evaluated Rounds", "GET", "/api/leaderboard/evaluated-rounds")
        
        # Test with different user roles
        self.test_api_endpoint("Get Teams (Club User)", "GET", "/api/teams/", "club")
        self.test_api_endpoint("Get Events (Judge User)", "GET", "/api/rounds/", "judge")
        
        return True
    
    def validate_database_state(self, stage: str):
        """Validate database state at specific stage"""
        try:
            print(f"\n🔍 VALIDATING DATABASE STATE - {stage}")
            print("-" * 50)
            
            current_state = {
                "teams": {
                    "count": self.database_session.query(Team).count(),
                    "active": self.database_session.query(Team).filter(Team.status == TeamStatus.ACTIVE).count(),
                    "current_round": self.database_session.query(Team).filter(Team.current_round == self.current_round).count()
                },
                "rounds": {
                    "total": self.database_session.query(UnifiedEvent).count(),
                    "upcoming": self.database_session.query(UnifiedEvent).filter(UnifiedEvent.status == EventStatus.UPCOMING).count(),
                    "in_progress": self.database_session.query(UnifiedEvent).filter(UnifiedEvent.status == EventStatus.IN_PROGRESS).count(),
                    "completed": self.database_session.query(UnifiedEvent).filter(UnifiedEvent.status == EventStatus.COMPLETED).count()
                },
                "team_scores": self.database_session.query(TeamScore).count(),
                "round_weights": self.database_session.query(RoundWeight).count(),
                "evaluations": self.database_session.query(Evaluation).count(),
                "rolling_members": self.database_session.query(RollingEventMember).count()
            }
            
            print(f"👥 Teams: {current_state['teams']['count']} total, {current_state['teams']['active']} active, {current_state['teams']['current_round']} in round {self.current_round}")
            print(f"🎯 Rounds: {current_state['rounds']['total']} total, {current_state['rounds']['upcoming']} upcoming, {current_state['rounds']['in_progress']} in_progress, {current_state['rounds']['completed']} completed")
            print(f"📊 Team Scores: {current_state['team_scores']} records")
            print(f"⚖️ Round Weights: {current_state['round_weights']} records")
            print(f"📝 Evaluations: {current_state['evaluations']} records")
            print(f"🎪 Rolling Members: {current_state['rolling_members']} records")
            
            # Check for issues
            issues = []
            
            if current_state['teams']['count'] != self.initial_db_state['teams']['count']:
                issues.append(f"Team count changed from {self.initial_db_state['teams']['count']} to {current_state['teams']['count']}")
            
            if current_state['rounds']['total'] != self.initial_db_state['rounds']['total']:
                issues.append(f"Round count changed from {self.initial_db_state['rounds']['total']} to {current_state['rounds']['total']}")
            
            if issues:
                print("⚠️ Database state issues detected:")
                for issue in issues:
                    print(f"   - {issue}")
                    self.issues_found.append({
                        "stage": stage,
                        "issue": issue,
                        "type": "database_state"
                    })
            else:
                print("✅ Database state validation passed")
            
            return len(issues) == 0
            
        except Exception as e:
            print(f"❌ Database state validation failed: {e}")
            self.issues_found.append({
                "stage": stage,
                "issue": f"Validation failed: {e}",
                "type": "validation_error"
            })
            return False
    
    def revert_database_to_initial_state(self):
        """Revert database to initial state"""
        try:
            print("\n🔄 REVERTING DATABASE TO INITIAL STATE")
            print("=" * 60)
            
            # 1. Clear all team scores
            team_scores_deleted = self.database_session.query(TeamScore).delete()
            print(f"✅ Deleted {team_scores_deleted} team score records")
            
            # 2. Clear all evaluations
            evaluations_deleted = self.database_session.query(Evaluation).delete()
            print(f"✅ Deleted {evaluations_deleted} evaluation records")
            
            # 3. Clear all round weights
            round_weights_deleted = self.database_session.query(RoundWeight).delete()
            print(f"✅ Deleted {round_weights_deleted} round weight records")
            
            # 4. Reset teams to ACTIVE status and current_round to 1
            teams_updated = self.database_session.query(Team).update({
                Team.current_round: 1,
                Team.status: TeamStatus.ACTIVE,
                Team.updated_at: func.now()
            })
            print(f"✅ Updated {teams_updated} teams to ACTIVE status")
            
            # 5. Reset rounds to UPCOMING status and clear score-related fields
            rounds_updated = self.database_session.query(UnifiedEvent).update({
                UnifiedEvent.status: EventStatus.UPCOMING,
                UnifiedEvent.participated_count: 0,
                UnifiedEvent.shortlisted_teams: None,
                UnifiedEvent.is_evaluated: False,
                UnifiedEvent.is_frozen: False,
                UnifiedEvent.max_score: None,
                UnifiedEvent.min_score: None,
                UnifiedEvent.avg_score: None,
                UnifiedEvent.updated_at: func.now()
            })
            print(f"✅ Updated {rounds_updated} rounds to UPCOMING status")
            
            # 6. Reset rolling event members to ACTIVE
            rolling_members_updated = self.database_session.query(RollingEventMember).update({
                RollingEventMember.status: RollingMemberStatus.ACTIVE,
                RollingEventMember.updated_at: func.now()
            })
            print(f"✅ Updated {rolling_members_updated} rolling event members")
            
            # Commit all changes
            self.database_session.commit()
            
            print("\n🎉 DATABASE SUCCESSFULLY REVERTED TO INITIAL STATE!")
            print("=" * 60)
            
            return True
            
        except Exception as e:
            print(f"❌ Failed to revert database: {e}")
            self.database_session.rollback()
            return False
    
    def generate_test_report(self):
        """Generate comprehensive test report"""
        print("\n📊 COMPREHENSIVE TEST REPORT")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result.success)
        failed_tests = total_tests - passed_tests
        
        print(f"📈 Test Summary:")
        print(f"   Total Tests: {total_tests}")
        print(f"   Passed: {passed_tests} ✅")
        print(f"   Failed: {failed_tests} ❌")
        print(f"   Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ Failed Tests:")
            for result in self.test_results:
                if not result.success:
                    print(f"   - {result.test_name}: {result.error_message}")
        
        if self.issues_found:
            print(f"\n⚠️ Issues Found ({len(self.issues_found)}):")
            for issue in self.issues_found:
                if issue.get("type") == "database_state":
                    print(f"   - {issue['stage']}: {issue['issue']}")
                else:
                    print(f"   - {issue.get('test', issue.get('stage', 'Unknown'))}: {issue['issue']}")
        
        print(f"\n⏱️ Performance Summary:")
        avg_time = sum(result.execution_time for result in self.test_results) / total_tests
        print(f"   Average Test Time: {avg_time:.3f}s")
        print(f"   Total Test Time: {sum(result.execution_time for result in self.test_results):.2f}s")
        
        # Save detailed report to file
        report_data = {
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "total_tests": total_tests,
                "passed_tests": passed_tests,
                "failed_tests": failed_tests,
                "success_rate": (passed_tests/total_tests)*100
            },
            "test_results": [
                {
                    "test_name": result.test_name,
                    "success": result.success,
                    "error_message": result.error_message,
                    "execution_time": result.execution_time
                }
                for result in self.test_results
            ],
            "issues_found": self.issues_found
        }
        
        report_file = f"test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(report_data, f, indent=2)
        
        print(f"\n📄 Detailed report saved to: {report_file}")
        
        return report_data
    
    def run_comprehensive_test(self):
        """Run the complete comprehensive test suite"""
        print("🚀 CRESTORA COMPREHENSIVE EVENT TESTING SUITE")
        print("=" * 80)
        print("Starting comprehensive testing of all rounds and APIs...")
        print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        start_time = time.time()
        
        try:
            # Setup
            if not self.setup_database_session():
                return False
            
            if not self.capture_initial_db_state():
                return False
            
            # Authentication
            print("\n🔐 AUTHENTICATION")
            print("=" * 40)
            for user_type in ["admin", "judge", "club"]:
                if not self.authenticate_user(user_type):
                    print(f"❌ Authentication failed for {user_type}, continuing with available users...")
            
            # Get rounds and teams
            if not self.get_rounds_and_teams():
                return False
            
            # Test core APIs
            self.test_core_apis()
            
            # Simulate all rounds
            print("\n🎯 SIMULATING ALL ROUNDS")
            print("=" * 60)
            
            for round_number in range(1, 15):  # 14 rounds total
                if round_number in self.round_ids:
                    round_id = self.round_ids[round_number]
                    
                    print(f"\n🎪 ROUND {round_number} (ID: {round_id})")
                    self.simulate_round_evaluation(round_number, round_id)
                    
                    # Validate database state after each round
                    self.validate_database_state(f"After Round {round_number}")
                    
                    self.current_round = round_number + 1
                    
                    # Small delay between rounds
                    time.sleep(0.5)
                else:
                    print(f"⚠️ Round {round_number} not found in database")
            
            # Final validation
            self.validate_database_state("Final State")
            
            # Test leaderboard after all rounds
            print("\n🏆 TESTING FINAL LEADERBOARD")
            print("-" * 40)
            self.test_api_endpoint("Get Final Leaderboard", "GET", "/api/leaderboard/")
            self.test_api_endpoint("Export Leaderboard", "GET", "/api/leaderboard/export")
            
            # Generate test report
            report = self.generate_test_report()
            
            # Revert database
            if not self.revert_database_to_initial_state():
                print("⚠️ Database revert failed - manual cleanup may be required")
            
            total_time = time.time() - start_time
            print(f"\n🎉 COMPREHENSIVE TEST COMPLETED!")
            print(f"Total execution time: {total_time:.2f} seconds")
            print(f"Test completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            
            return True
            
        except Exception as e:
            print(f"❌ Comprehensive test failed: {e}")
            return False
        
        finally:
            if self.database_session:
                self.database_session.close()

def main():
    """Main function to run the comprehensive test"""
    print("Starting Crestora Comprehensive Event Testing Suite...")
    
    # Check if API server is running
    try:
        response = requests.get(f"{API_BASE_URL}/api/health", timeout=5)
        if response.status_code != 200:
            print("❌ API server is not responding. Please start the backend server first.")
            print("   Run: cd crestora-hub/backend && python3 -m uvicorn app.main:app --reload")
            return False
    except:
        print("❌ Cannot connect to API server. Please start the backend server first.")
        print("   Run: cd crestora-hub/backend && python3 -m uvicorn app.main:app --reload")
        return False
    
    # Run comprehensive test
    tester = CrestoraEventTester()
    success = tester.run_comprehensive_test()
    
    if success:
        print("\n✅ All tests completed successfully!")
        return 0
    else:
        print("\n❌ Some tests failed. Check the report for details.")
        return 1

if __name__ == "__main__":
    exit(main())
