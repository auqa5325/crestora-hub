import sys
import os
from pathlib import Path

# Add the backend directory to the Python path
sys.path.append(str(Path(__file__).parent))

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models.auth import User, UserRole
from app.auth import get_password_hash

def create_student_user():
    db = SessionLocal()
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.username == "Student").first()
        if existing_user:
            print("User 'Student' already exists.")
            return

        # Create new student user
        hashed_password = get_password_hash("Crestora2025")
        student = User(
            username="Student",
            email="student@crestora.com",
            full_name="Student User",
            hashed_password=hashed_password,
            role=UserRole.STUDENT,
            is_active=True
        )
        
        db.add(student)
        db.commit()
        print("Student user created successfully!")
        print("Username: Student")
        print("Password: Crestora2025")
    except Exception as e:
        print(f"Error creating student user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_student_user()
