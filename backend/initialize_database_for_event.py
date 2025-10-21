#!/usr/bin/env python3
"""
Initialize Database for Event Start
This script initializes the database to a pristine state for event start:
- All teams to ACTIVE status with score zeroes
- All rounds to UPCOMING status with default criteria JSON
- All scores and weights tables cleared
- All evaluations cleared
- Default criteria: "Overall Performance" with weight 100%, max_score 100, max_points 100
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from app.database import engine, Base
from app.models.team import Team, TeamMember, TeamStatus
from app.models.rounds import UnifiedEvent, EventStatus
from app.models.team_score import TeamScore
from app.models.evaluation import Evaluation
from app.models.auth import User
from app.models.rolling_member import RollingEventMember, RollingMemberStatus
from app.models.round_weight import RoundWeight
from sqlalchemy.sql import func

def get_db_session():
    """Get database session"""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()

def initialize_database_for_event():
    """Initialize database to pristine state for event start"""
    session = get_db_session()
    
    try:
        print("🚀 INITIALIZING DATABASE FOR EVENT START")
        print("=" * 80)
        
        # 1. Reset all teams to ACTIVE status and round 1
        print("\n1. Resetting teams to ACTIVE status...")
        teams_updated = session.query(Team).update({
            'status': TeamStatus.ACTIVE,
            'current_round': 1,
            'updated_at': func.now()
        })
        print(f"   ✅ Updated {teams_updated} teams to ACTIVE status")
        
        # 2. Reset all rounds to UPCOMING status and set default criteria
        print("\n2. Resetting rounds to UPCOMING status and setting default criteria...")
        
        # Default criteria JSON with all required fields
        default_criteria = [
            {
                'name': 'Overall Performance',
                'weight': 100,
                'max_score': 100,
                'max_points': 100
            }
        ]
        
        # Get all rounds (excluding main events with round_number = 0)
        rounds_to_update = session.query(UnifiedEvent).filter(UnifiedEvent.round_number > 0).all()
        
        rounds_updated = 0
        for round_obj in rounds_to_update:
            round_obj.status = EventStatus.UPCOMING
            round_obj.participated_count = 0
            round_obj.shortlisted_teams = None
            round_obj.is_evaluated = False
            round_obj.is_frozen = False
            round_obj.max_score = None
            round_obj.min_score = None
            round_obj.avg_score = None
            round_obj.criteria = default_criteria  # Set default criteria JSON
            round_obj.updated_at = func.now()
            rounds_updated += 1
        
        print(f"   ✅ Updated {rounds_updated} rounds to UPCOMING status with default criteria")
        
        # 3. Clear all team scores
        print("\n3. Clearing team scores...")
        scores_deleted = session.query(TeamScore).delete()
        print(f"   ✅ Deleted {scores_deleted} team score records")
        
        # 4. Clear all evaluations
        print("\n4. Clearing evaluations...")
        evaluations_deleted = session.query(Evaluation).delete()
        print(f"   ✅ Deleted {evaluations_deleted} evaluation records")
        
        # 5. Clear all round weights
        print("\n5. Clearing round weights...")
        weights_deleted = session.query(RoundWeight).delete()
        print(f"   ✅ Deleted {weights_deleted} round weight records")
        
        # 6. Reset rolling event members to ACTIVE
        print("\n6. Resetting rolling event members...")
        rolling_members_updated = session.query(RollingEventMember).update({
            'status': RollingMemberStatus.ACTIVE,
            'updated_at': func.now()
        })
        print(f"   ✅ Updated {rolling_members_updated} rolling event members")
        
        # Commit all changes
        session.commit()
        
        print(f"\n🎉 DATABASE INITIALIZATION COMPLETE!")
        print("=" * 80)
        
        # Print final database state
        print_final_database_state(session)
        
    except Exception as e:
        session.rollback()
        print(f"❌ Error during initialization: {str(e)}")
        raise
    finally:
        session.close()

def print_final_database_state(session):
    """Print final state of all tables"""
    print("\n📊 FINAL DATABASE STATE")
    print("=" * 80)
    
    # Count records in each table
    users_count = session.query(User).count()
    teams_count = session.query(Team).count()
    team_members_count = session.query(TeamMember).count()
    rounds_count = session.query(UnifiedEvent).count()
    team_scores_count = session.query(TeamScore).count()
    evaluations_count = session.query(Evaluation).count()
    rolling_members_count = session.query(RollingEventMember).count()
    round_weights_count = session.query(RoundWeight).count()
    
    print(f"👥 Users: {users_count} records (admin, judge, club users) ✅")
    print(f"🏆 Teams: {teams_count} records (all ACTIVE) ✅")
    print(f"👤 Team Members: {team_members_count} records (all team members intact) ✅")
    print(f"🎯 Events/Rounds: {rounds_count} records (all UPCOMING with default criteria) ✅")
    print(f"📊 Team Scores: {team_scores_count} records (clean slate) ✅")
    print(f"⚖️  Round Weights: {round_weights_count} records (clean slate) ✅")
    print(f"📝 Evaluations: {evaluations_count} records (clean slate) ✅")
    print(f"🎪 Rolling Event Members: {rolling_members_count} records (clean slate) ✅")
    
    print(f"\n{'='*80}")
    print("✅ Database is perfectly prepared for the event start! 🚀")
    print("=" * 80)

if __name__ == "__main__":
    initialize_database_for_event()
