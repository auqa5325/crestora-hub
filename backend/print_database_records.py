#!/usr/bin/env python3
"""
Database Records Printer for Crestora'25
This script prints the top 5 records from all tables in the database
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import sessionmaker
from app.database import engine, Base
from app.models.team import Team, TeamMember, TeamStatus
from app.models.rounds import UnifiedEvent, EventStatus
from app.models.team_score import TeamScore
from app.models.evaluation import Evaluation
from app.models.auth import User
from app.models.rolling_member import RollingEventMember, RollingMemberStatus
from app.models.rolling_results import RollingEventResult
from app.models.round_weight import RoundWeight

def get_db_session():
    """Get database session"""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()

def print_table_records(session, table_name, model_class, limit=5):
    """Print top N records from a table"""
    print(f"\n{'='*80}")
    print(f"TABLE: {table_name.upper()}")
    print(f"{'='*80}")
    
    # Get total count
    total_count = session.query(model_class).count()
    print(f"Total Records: {total_count}")
    
    if total_count == 0:
        print("No records found.")
        return
    
    # Get top N records
    records = session.query(model_class).limit(limit).all()
    
    # Print column headers
    if hasattr(model_class, '__table__'):
        columns = model_class.__table__.columns.keys()
        print(f"Columns: {', '.join(columns)}")
    
    print(f"\nTop {len(records)} records:")
    print("-" * 80)
    
    for i, record in enumerate(records, 1):
        print(f"{i}. {record}")

def print_database_records():
    """Print top 5 records from all database tables"""
    session = get_db_session()
    
    try:
        print("🗃️  CRESTORA'25 DATABASE RECORDS")
        print("=" * 80)
        
        # Print records from each table
        print_table_records(session, "users", User)
        print_table_records(session, "teams", Team)
        print_table_records(session, "team_members", TeamMember)
        print_table_records(session, "events/rounds", UnifiedEvent)
        print_table_records(session, "team_scores", TeamScore)
        print_table_records(session, "evaluations", Evaluation)
        print_table_records(session, "rolling_event_members", RollingEventMember)
        print_table_records(session, "rolling_event_results", RollingEventResult)
        print_table_records(session, "round_weights", RoundWeight)
        
        print(f"\n{'='*80}")
        print("✅ Database records printing complete!")
        print("=" * 80)
        
    except Exception as e:
        print(f"❌ Error printing database records: {str(e)}")
        raise
    finally:
        session.close()

if __name__ == "__main__":
    print_database_records()
