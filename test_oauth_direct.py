#!/usr/bin/env python3
"""
Direct test of SmugMug OAuth implementation
"""

import asyncio
import sys
sys.path.append('backend')

from smugmug_auth import SmugMugOAuth
from config import settings

async def test_oauth():
    """Test OAuth request token generation"""
    print("Testing SmugMug OAuth...")
    print(f"API Key: {settings.SMUGMUG_API_KEY[:20]}...")
    print(f"Callback URL: {settings.SMUGMUG_CALLBACK_URL}")
    
    oauth = SmugMugOAuth()
    
    print("\nRequesting token from SmugMug...")
    token_data = await oauth.get_request_token()
    
    if token_data:
        print("✅ Success! Got request token:")
        print(f"   Token: {token_data['oauth_token']}")
        print(f"   Secret: {token_data['oauth_token_secret'][:20]}...")
        print(f"   Callback confirmed: {token_data['oauth_callback_confirmed']}")
        
        auth_url = oauth.get_authorization_url(token_data['oauth_token'])
        print(f"\n Authorization URL: {auth_url}")
    else:
        print("❌ Failed to get request token")
        print("\nPossible issues:")
        print("1. API keys might be incorrect")
        print("2. SmugMug API might be down")
        print("3. Network connectivity issues")

if __name__ == "__main__":
    asyncio.run(test_oauth())