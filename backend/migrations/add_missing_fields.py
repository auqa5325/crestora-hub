import os
import sys
from dotenv import load_dotenv
from sqlalchemy import text
from app.database import engine

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
load_dotenv()

def add_missing_fields():
    print("🔧 Adding missing fields to rounds table...")
    try:
        with engine.connect() as conn:
            # Add form_link field
            statement1 = "ALTER TABLE rounds ADD COLUMN form_link VARCHAR(500)"
            try:
                conn.execute(text(statement1))
                print(f"✅ Executed: {statement1}")
            except Exception as e:
                if "Duplicate column name" in str(e) or "already exists" in str(e):
                    print(f"⚠️  Column already exists, skipping: {statement1}")
                else:
                    print(f"❌ Error executing {statement1}: {e}")
            
            # Add contact field
            statement2 = "ALTER TABLE rounds ADD COLUMN contact VARCHAR(200)"
            try:
                conn.execute(text(statement2))
                print(f"✅ Executed: {statement2}")
            except Exception as e:
                if "Duplicate column name" in str(e) or "already exists" in str(e):
                    print(f"⚠️  Column already exists, skipping: {statement2}")
                else:
                    print(f"❌ Error executing {statement2}: {e}")
            
            conn.commit()
            print("✅ Missing fields added to rounds table successfully!")
    except Exception as e:
        print(f"❌ Error adding missing fields to rounds table: {e}")
        raise

if __name__ == "__main__":
    add_missing_fields()

