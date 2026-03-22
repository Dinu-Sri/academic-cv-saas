#!/usr/bin/env python3
"""Script to create admin user"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import SessionLocal, init_db
from app.models import User
from passlib.context import CryptContext
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_admin():
    """Create admin user"""
    db = SessionLocal()
    
    try:
        # Check if admin exists
        existing_admin = db.query(User).filter(User.email == settings.ADMIN_EMAIL).first()
        
        if existing_admin:
            print(f"Admin user already exists: {settings.ADMIN_EMAIL}")
            return
        
        # Create admin user
        admin_password = os.getenv("ADMIN_PASSWORD", "admin123")  # Change this!
        hashed_password = pwd_context.hash(admin_password)
        
        admin = User(
            email=settings.ADMIN_EMAIL,
            username="admin",
            hashed_password=hashed_password,
            full_name="System Administrator",
            is_active=True,
            is_superuser=True,
            subscription_plan="enterprise"
        )
        
        db.add(admin)
        db.commit()
        
        print("=" * 60)
        print("Admin user created successfully!")
        print("=" * 60)
        print(f"Email: {settings.ADMIN_EMAIL}")
        print(f"Password: {admin_password}")
        print("=" * 60)
        print("IMPORTANT: Change the password after first login!")
        print("=" * 60)
        
    except Exception as e:
        print(f"Error creating admin user: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    print("Initializing database...")
    init_db()
    
    print("Creating admin user...")
    create_admin()
