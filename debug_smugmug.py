#!/usr/bin/env python3
"""
Debug SmugMug API calls
"""

import asyncio
import sys
sys.path.append('backend')

from database import SessionLocal
from models import OAuthToken
from smugmug_auth import SmugMugOAuth
import json

async def debug_api():
    """Debug API calls to SmugMug"""
    print("Debugging SmugMug API...")
    
    db = SessionLocal()
    token = db.query(OAuthToken).filter_by(service="smugmug").first()
    db.close()
    
    if not token:
        print("No token found")
        return
        
    oauth = SmugMugOAuth()
    
    # Test 1: Get current user
    print("\n1. Testing !authuser endpoint...")
    url = "https://api.smugmug.com/api/v2!authuser"
    response = await oauth.make_authenticated_request(
        "GET", url, token.access_token, token.access_token_secret
    )
    
    if response:
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            user = data.get("Response", {}).get("User", {})
            print(f"   User: {user.get('NickName')}")
            
            # Get the UserAlbums URI
            user_albums_uri = user.get("Uris", {}).get("UserAlbums", {}).get("Uri")
            print(f"   UserAlbums URI: {user_albums_uri}")
            
            if user_albums_uri:
                # Test 2: Get albums
                print("\n2. Testing albums endpoint...")
                albums_url = f"https://api.smugmug.com{user_albums_uri}"
                print(f"   URL: {albums_url}")
                
                albums_response = await oauth.make_authenticated_request(
                    "GET", albums_url, token.access_token, token.access_token_secret,
                    params={"count": "10"}
                )
                
                if albums_response:
                    print(f"   Status: {albums_response.status_code}")
                    if albums_response.status_code == 200:
                        albums_data = albums_response.json()
                        albums = albums_data.get("Response", {}).get("Album", [])
                        print(f"   Found {len(albums)} albums")
                        for album in albums[:3]:
                            print(f"     - {album.get('Name')}")
                    else:
                        print(f"   Error: {albums_response.text[:200]}")
                else:
                    print("   No response from albums endpoint")
        else:
            print(f"   Error: {response.text[:200]}")
    else:
        print("   No response from auth endpoint")

if __name__ == "__main__":
    asyncio.run(debug_api())