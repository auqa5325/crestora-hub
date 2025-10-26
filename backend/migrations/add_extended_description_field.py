import os
import sys
from dotenv import load_dotenv
from sqlalchemy import text
from app.database import engine

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
load_dotenv()

def add_extended_description_field():
    print("🔧 Adding extended_description field to rounds table...")
    try:
        with engine.connect() as conn:
            statement = "ALTER TABLE rounds ADD COLUMN extended_description TEXT"
            try:
                conn.execute(text(statement))
                print(f"✅ Executed: {statement}")
            except Exception as e:
                if "Duplicate column name" in str(e) or "already exists" in str(e):
                    print(f"⚠️  Column already exists, skipping: {statement}")
                else:
                    print(f"❌ Error executing {statement}: {e}")
            conn.commit()
            print("✅ extended_description field added to rounds table successfully!")
    except Exception as e:
        print(f"❌ Error adding extended_description field to rounds table: {e}")
        raise

if __name__ == "__main__":
    add_extended_description_field()


