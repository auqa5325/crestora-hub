#!/usr/bin/env python3
"""
Simple test script to verify Gmail authentication
Run this after adding test users to verify the setup works
"""

import os
import sys
from app.services.gmail_service import gmail_service

def test_gmail_auth():
    print("🔍 Testing Gmail Authentication...")
    print("=" * 50)
    
    # Check if credentials file exists
    if not os.path.exists('credentials.json'):
        print("❌ credentials.json not found!")
        print("Please ensure the Gmail credentials file is in the backend directory")
        return False
    
    print("✅ credentials.json found")
    
    # Test Gmail service initialization
    try:
        is_authenticated = gmail_service.is_authenticated()
        if is_authenticated:
            print("✅ Gmail service authenticated successfully!")
            print("🎉 Ready to send emails!")
            return True
        else:
            print("❌ Gmail service not authenticated")
            print("💡 Make sure you've added test users in Google Cloud Console")
            return False
    except Exception as e:
        print(f"❌ Error during authentication: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_gmail_auth()
    if success:
        print("\n🚀 Gmail integration is ready!")
        print("You can now use the 'Email CSV' feature in the leaderboard.")
    else:
        print("\n🔧 Please fix the authentication issues above.")
        print("Check the README_GMAIL_SETUP.md for detailed instructions.")
    
    sys.exit(0 if success else 1)
