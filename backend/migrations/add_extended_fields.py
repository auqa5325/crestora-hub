#!/usr/bin/env python3
"""
Migration script to add extended_description, form_link, and contact fields to rounds table
"""

import os
import sys
from dotenv import load_dotenv

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

load_dotenv()

from sqlalchemy import text
from app.database import engine

def add_extended_fields():
    """Add extended_description, form_link, and contact fields to the rounds table"""
    print("🔧 Adding extended fields to rounds table...")
    
    try:
        with engine.connect() as conn:
            # Add new columns to rounds table
            alter_statements = [
                "ALTER TABLE rounds ADD COLUMN extended_description TEXT",
                "ALTER TABLE rounds ADD COLUMN form_link VARCHAR(500)",
                "ALTER TABLE rounds ADD COLUMN contact VARCHAR(200)"
            ]
            
            for statement in alter_statements:
                try:
                    conn.execute(text(statement))
                    print(f"✅ Executed: {statement}")
                except Exception as e:
                    if "Duplicate column name" in str(e) or "already exists" in str(e):
                        print(f"⚠️  Column already exists, skipping: {statement}")
                    else:
                        print(f"❌ Error executing {statement}: {e}")
            
            conn.commit()
            print("✅ Extended fields added to rounds table successfully!")
            
    except Exception as e:
        print(f"❌ Error adding extended fields to rounds table: {e}")
        raise

if __name__ == "__main__":
    add_extended_fields()

