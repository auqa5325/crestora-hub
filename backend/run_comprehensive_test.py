#!/usr/bin/env python3
"""
Quick runner script for the Comprehensive Event Testing Suite
"""

import subprocess
import sys
import os

def main():
    """Run the comprehensive test suite"""
    print("🚀 Starting Crestora Comprehensive Event Testing Suite...")
    print("=" * 60)
    
    # Check if we're in the right directory
    if not os.path.exists("comprehensive_event_test.py"):
        print("❌ comprehensive_event_test.py not found in current directory")
        print("Please run this script from the backend directory")
        return 1
    
    # Check if API server is running
    try:
        import requests
        response = requests.get("http://localhost:8000/api/health", timeout=5)
        if response.status_code != 200:
            print("❌ API server is not responding")
            print("Please start the backend server first:")
            print("   python3 -m uvicorn app.main:app --reload")
            return 1
    except:
        print("❌ Cannot connect to API server")
        print("Please start the backend server first:")
        print("   python3 -m uvicorn app.main:app --reload")
        return 1
    
    print("✅ API server is running")
    print("✅ Starting comprehensive test...")
    print()
    
    # Run the comprehensive test
    try:
        result = subprocess.run([sys.executable, "comprehensive_event_test.py"], 
                              capture_output=False, text=True)
        return result.returncode
    except KeyboardInterrupt:
        print("\n⚠️ Test interrupted by user")
        return 1
    except Exception as e:
        print(f"❌ Error running test: {e}")
        return 1

if __name__ == "__main__":
    exit(main())
