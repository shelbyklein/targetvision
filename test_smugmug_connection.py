#!/usr/bin/env python3
"""
Test SmugMug connection persistence and API access
"""

import asyncio
import sys
sys.path.append('backend')

from database import SessionLocal
from models import OAuthToken
from smugmug_service import SmugMugService
from smugmug_auth import SmugMugOAuth

async def test_connection():
    """Test that we can connect to SmugMug API with stored token"""
    print("=" * 60)
    print("Testing SmugMug Connection")
    print("=" * 60)
    
    # Get stored token from database
    db = SessionLocal()
    try:
        token = db.query(OAuthToken).filter_by(service="smugmug").first()
        
        if not token:
            print("❌ No OAuth token found in database")
            print("   Please complete OAuth flow first")
            return False
            
        print(f"✅ Found OAuth token in database")
        print(f"   Created: {token.created_at}")
        print(f"   Access Token: {token.access_token[:20]}...")
        
        # Test the connection
        print("\n📡 Testing SmugMug API connection...")
        service = SmugMugService(token.access_token, token.access_token_secret)
        
        # Try to get current user
        print("   Fetching current user info...")
        user = await service.get_current_user()
        
        if user:
            print(f"✅ Successfully connected to SmugMug!")
            print(f"   Name: {user.get('Name', 'N/A')}")
            print(f"   NickName: {user.get('NickName', 'N/A')}")
            print(f"   WebUri: {user.get('WebUri', 'N/A')}")
            
            # Update the token with user info if we got it
            if user.get('NickName'):
                token.username = user.get('NickName')
                db.commit()
                print(f"   Updated username in database")
            
            return True
        else:
            print("❌ Failed to get user info from SmugMug")
            print("   The token might be invalid or expired")
            return False
            
    except Exception as e:
        print(f"❌ Error testing connection: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()

async def test_fetch_albums():
    """Test fetching albums from SmugMug"""
    print("\n" + "=" * 60)
    print("Testing Album Fetch")
    print("=" * 60)
    
    db = SessionLocal()
    try:
        token = db.query(OAuthToken).filter_by(service="smugmug").first()
        if not token:
            print("❌ No OAuth token found")
            return False
            
        service = SmugMugService(token.access_token, token.access_token_secret)
        
        print("📁 Fetching albums...")
        albums = await service.get_user_albums()
        
        if albums:
            print(f"✅ Found {len(albums)} albums:")
            for i, album in enumerate(albums[:5], 1):  # Show first 5
                print(f"   {i}. {album.get('Name', 'Unnamed')}")
                print(f"      URI: {album.get('Uri', 'N/A')}")
                print(f"      Images: {album.get('ImageCount', 0)}")
            
            if len(albums) > 5:
                print(f"   ... and {len(albums) - 5} more")
            
            return True
        else:
            print("❌ No albums found or failed to fetch")
            return False
            
    except Exception as e:
        print(f"❌ Error fetching albums: {e}")
        return False
    finally:
        db.close()

async def main():
    """Run all connection tests"""
    
    # Test 1: Basic connection
    connection_ok = await test_connection()
    
    if connection_ok:
        # Test 2: Fetch albums
        albums_ok = await test_fetch_albums()
        
        print("\n" + "=" * 60)
        print("Test Summary")
        print("=" * 60)
        print(f"✅ Connection Test: {'PASSED' if connection_ok else 'FAILED'}")
        print(f"✅ Albums Test: {'PASSED' if albums_ok else 'FAILED'}")
        
        if connection_ok and albums_ok:
            print("\n🎉 SmugMug connection is working perfectly!")
            print("   You can now sync photos from your albums.")
        else:
            print("\n⚠️  Some tests failed. Check the errors above.")
    else:
        print("\n❌ Connection test failed. Please re-authenticate.")

if __name__ == "__main__":
    asyncio.run(main())