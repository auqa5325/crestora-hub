#!/usr/bin/env python3
"""
Migration script to add is_wildcard field to rounds table
"""

import os
import sys
from dotenv import load_dotenv

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

load_dotenv()

from sqlalchemy import text
from app.database import engine

def add_wildcard_field():
    """Add is_wildcard field to the rounds table"""
    print("🔧 Adding is_wildcard field to rounds table...")
    
    try:
        with engine.connect() as conn:
            # Add is_wildcard column to rounds table
            alter_statement = "ALTER TABLE rounds ADD COLUMN is_wildcard BOOLEAN DEFAULT FALSE"
            
            try:
                conn.execute(text(alter_statement))
                print(f"✅ Executed: {alter_statement}")
            except Exception as e:
                if "Duplicate column name" in str(e) or "already exists" in str(e):
                    print(f"⚠️  Column already exists, skipping: {alter_statement}")
                else:
                    print(f"❌ Error executing {alter_statement}: {e}")
                    raise
            
            conn.commit()
            print("✅ is_wildcard field added to rounds table successfully!")
            
    except Exception as e:
        print(f"❌ Error adding is_wildcard field to rounds table: {e}")
        raise

if __name__ == "__main__":
    add_wildcard_field()

