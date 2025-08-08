#!/usr/bin/env python3
"""
Test script to verify TargetVision setup
"""

import os
import sys
sys.path.append('backend')

def test_imports():
    """Test that all required modules can be imported"""
    print("Testing imports...")
    try:
        import fastapi
        print("✓ FastAPI imported")
        
        import sqlalchemy
        print("✓ SQLAlchemy imported")
        
        import psycopg
        print("✓ psycopg imported")
        
        import httpx
        print("✓ httpx imported")
        
        import anthropic
        print("✓ Anthropic imported")
        
        from config import settings
        print("✓ Config loaded")
        
        from database import engine, test_connection
        print("✓ Database module loaded")
        
        from models import Photo, AIMetadata, OAuthToken
        print("✓ Models loaded")
        
        from smugmug_auth import SmugMugOAuth
        print("✓ SmugMug OAuth loaded")
        
        from smugmug_service import SmugMugService
        print("✓ SmugMug Service loaded")
        
        print("\n✅ All imports successful!")
        return True
    except ImportError as e:
        print(f"\n❌ Import error: {e}")
        return False

def test_config():
    """Test configuration"""
    print("\nTesting configuration...")
    from config import settings
    
    print(f"  DEBUG: {settings.DEBUG}")
    print(f"  PORT: {settings.PORT}")
    print(f"  Database configured: {bool(settings.DATABASE_URL)}")
    print(f"  SmugMug API configured: {bool(settings.SMUGMUG_API_KEY)}")
    print(f"  Anthropic API configured: {bool(settings.ANTHROPIC_API_KEY)}")
    
    if not settings.SMUGMUG_API_KEY:
        print("\n⚠️  Warning: SmugMug API key not configured in .env")
    if not settings.ANTHROPIC_API_KEY:
        print("⚠️  Warning: Anthropic API key not configured in .env")
    
    return True

def test_database():
    """Test database connection"""
    print("\nTesting database connection...")
    from database import test_connection, init_db
    
    if test_connection():
        print("✓ Database connection successful")
        
        # Try to initialize tables
        if init_db():
            print("✓ Database tables ready")
            return True
        else:
            print("❌ Failed to initialize database tables")
            return False
    else:
        print("❌ Database connection failed")
        print("  Make sure PostgreSQL is running and database 'targetvision' exists")
        return False

def test_api():
    """Test FastAPI application"""
    print("\nTesting FastAPI application...")
    try:
        from main import app
        print("✓ FastAPI app created")
        
        # Check routes
        routes = [route.path for route in app.routes]
        print(f"✓ {len(routes)} routes registered")
        
        # List key endpoints
        key_endpoints = ['/health', '/auth/smugmug/request', '/photos/sync', '/photos']
        for endpoint in key_endpoints:
            if any(endpoint in route for route in routes):
                print(f"  ✓ {endpoint} endpoint available")
        
        return True
    except Exception as e:
        print(f"❌ FastAPI error: {e}")
        return False

def main():
    """Run all tests"""
    print("=" * 60)
    print("TargetVision Setup Test")
    print("=" * 60)
    
    results = []
    
    # Run tests
    results.append(("Imports", test_imports()))
    results.append(("Configuration", test_config()))
    results.append(("Database", test_database()))
    results.append(("API", test_api()))
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    all_passed = True
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{test_name:20} {status}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✅ All tests passed! Your environment is ready.")
        print("\nNext steps:")
        print("1. Add your API keys to .env file")
        print("2. Run: python backend/main.py")
        print("3. Visit: http://localhost:8000/docs")
    else:
        print("❌ Some tests failed. Please fix the issues above.")
    print("=" * 60)

if __name__ == "__main__":
    main()