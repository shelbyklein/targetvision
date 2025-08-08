#!/usr/bin/env python3
"""
Test SmugMug OAuth Flow
This script will guide you through the OAuth authentication process
"""

import httpx
import json
import webbrowser
import sys
from urllib.parse import urlparse, parse_qs

API_BASE = "http://localhost:8000"

def test_oauth_flow():
    """Test the complete OAuth flow"""
    print("=" * 60)
    print("SmugMug OAuth Flow Test")
    print("=" * 60)
    
    # Step 1: Check if already authenticated
    print("\n1. Checking current authentication status...")
    response = httpx.get(f"{API_BASE}/auth/status")
    auth_status = response.json()
    
    if auth_status.get("authenticated"):
        print(f"✅ Already authenticated as: {auth_status.get('username')}")
        print(f"   User ID: {auth_status.get('user_id')}")
        return True
    else:
        print("❌ Not authenticated. Starting OAuth flow...")
    
    # Step 2: Initiate OAuth
    print("\n2. Requesting OAuth authorization URL...")
    response = httpx.post(f"{API_BASE}/auth/smugmug/request")
    
    if response.status_code != 200:
        print(f"❌ Failed to get authorization URL: {response.status_code}")
        print(f"   Response: {response.text}")
        return False
    
    oauth_data = response.json()
    auth_url = oauth_data.get("auth_url")
    request_token = oauth_data.get("request_token")
    
    print(f"✅ Got authorization URL")
    print(f"   Request token: {request_token[:20]}...")
    
    # Step 3: Open browser for authorization
    print("\n3. Opening browser for authorization...")
    print("=" * 60)
    print("IMPORTANT: Please follow these steps:")
    print("1. Your browser will open to SmugMug")
    print("2. Log in to your SmugMug account")
    print("3. Authorize the application")
    print("4. You'll be redirected back to the app")
    print("5. Copy the FULL URL from your browser")
    print("=" * 60)
    
    input("\nPress Enter to open SmugMug authorization page...")
    webbrowser.open(auth_url)
    
    # Step 4: Get callback URL from user
    print("\n4. Waiting for authorization...")
    print("After authorizing, you'll see a page that says:")
    print("'SmugMug authentication successful!' or an error")
    print("\nPaste the FULL URL from your browser here:")
    callback_url = input("URL: ").strip()
    
    # Parse the callback URL
    try:
        parsed = urlparse(callback_url)
        params = parse_qs(parsed.query)
        oauth_token = params.get("oauth_token", [None])[0]
        oauth_verifier = params.get("oauth_verifier", [None])[0]
        
        if not oauth_token or not oauth_verifier:
            print("❌ Invalid callback URL. Missing oauth_token or oauth_verifier")
            return False
            
        print(f"✅ Got OAuth verifier")
        
    except Exception as e:
        print(f"❌ Failed to parse callback URL: {e}")
        return False
    
    # Step 5: Complete OAuth flow (the callback endpoint handles this)
    print("\n5. Completing OAuth flow...")
    print("The callback was already processed when you visited the URL.")
    
    # Step 6: Verify authentication
    print("\n6. Verifying authentication...")
    response = httpx.get(f"{API_BASE}/auth/status")
    auth_status = response.json()
    
    if auth_status.get("authenticated"):
        print(f"✅ Successfully authenticated!")
        print(f"   Username: {auth_status.get('username')}")
        print(f"   User ID: {auth_status.get('user_id')}")
        return True
    else:
        print("❌ Authentication failed")
        return False

def test_photo_sync():
    """Test photo syncing after authentication"""
    print("\n" + "=" * 60)
    print("Testing Photo Sync")
    print("=" * 60)
    
    # Check authentication first
    response = httpx.get(f"{API_BASE}/auth/status")
    if not response.json().get("authenticated"):
        print("❌ Not authenticated. Run OAuth flow first.")
        return False
    
    # Sync photos
    print("\nSyncing photos from SmugMug (limit: 10 for testing)...")
    response = httpx.post(f"{API_BASE}/photos/sync?limit=10", timeout=30.0)
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Sync successful!")
        print(f"   Photos synced: {result.get('synced')}")
        print(f"   Total photos in database: {result.get('total_photos')}")
        
        # List photos
        print("\nFetching synced photos...")
        response = httpx.get(f"{API_BASE}/photos?limit=5")
        photos = response.json()
        
        if photos:
            print(f"\nFirst {min(5, len(photos))} photos:")
            for i, photo in enumerate(photos[:5], 1):
                print(f"   {i}. {photo.get('title', 'Untitled')}")
                print(f"      Album: {photo.get('album_name')}")
                print(f"      ID: {photo.get('smugmug_id')}")
        
        return True
    else:
        print(f"❌ Sync failed: {response.status_code}")
        print(f"   Response: {response.text}")
        return False

def main():
    """Run all tests"""
    print("\n🚀 Starting SmugMug OAuth Test\n")
    
    # Test OAuth
    if test_oauth_flow():
        print("\n✅ OAuth flow test passed!")
        
        # Ask if user wants to test sync
        print("\nWould you like to test photo syncing?")
        choice = input("Enter 'y' to sync photos, or any other key to skip: ")
        
        if choice.lower() == 'y':
            test_photo_sync()
    else:
        print("\n❌ OAuth flow test failed")
        print("\nTroubleshooting tips:")
        print("1. Make sure your SmugMug API keys are correct in .env")
        print("2. Check that the callback URL is set to: http://localhost:8000/auth/callback")
        print("3. Ensure the server is running: python backend/main.py")
        print("4. Check server logs for error details")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nTest cancelled by user")
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()