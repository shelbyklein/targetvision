#!/usr/bin/env python3
"""
Test OAuth with different parameter combinations
"""

import asyncio
import sys
sys.path.append('backend')

from database import SessionLocal
from models import OAuthToken
from smugmug_auth import SmugMugOAuth

async def test_oauth():
    """Test OAuth with various parameters"""
    db = SessionLocal()
    token = db.query(OAuthToken).filter_by(service="smugmug").first()
    db.close()
    
    if not token:
        print("No token found")
        return
        
    oauth = SmugMugOAuth()
    url = "https://api.smugmug.com/api/v2/album/X9BpR5!images"
    
    # Test 1: No parameters
    print("Test 1: No parameters")
    response = await oauth.make_authenticated_request(
        "GET", url, token.access_token, token.access_token_secret
    )
    print(f"Status: {response.status_code if response else 'None'}")
    if response and response.status_code == 200:
        data = response.json()
        images = data.get("Response", {}).get("AlbumImage", [])
        print(f"Found {len(images)} images (should be many)")
    
    # Test 2: Simple parameter
    print("\nTest 2: With count parameter")
    response = await oauth.make_authenticated_request(
        "GET", url, token.access_token, token.access_token_secret,
        params={"count": "2"}
    )
    print(f"Status: {response.status_code if response else 'None'}")
    if response and response.status_code == 200:
        data = response.json()
        images = data.get("Response", {}).get("AlbumImage", [])
        print(f"Found {len(images)} images (should be 2)")
    
    # Test 3: Parameter with underscore
    print("\nTest 3: With _expand parameter")
    response = await oauth.make_authenticated_request(
        "GET", url, token.access_token, token.access_token_secret,
        params={"_expand": "ImageSizes"}
    )
    print(f"Status: {response.status_code if response else 'None'}")
    if response and response.status_code == 200:
        data = response.json()
        images = data.get("Response", {}).get("AlbumImage", [])
        print(f"Found {len(images)} images")
        if images and "ImageSizes" in images[0]:
            print("  ImageSizes expanded successfully")
    
    # Test 4: Multiple parameters
    print("\nTest 4: With multiple parameters")
    response = await oauth.make_authenticated_request(
        "GET", url, token.access_token, token.access_token_secret,
        params={"count": "2", "_expand": "ImageSizes"}
    )
    print(f"Status: {response.status_code if response else 'None'}")
    if response and response.status_code == 200:
        data = response.json()
        images = data.get("Response", {}).get("AlbumImage", [])
        print(f"Found {len(images)} images (should be 2)")
        if images and "ImageSizes" in images[0]:
            print("  ImageSizes expanded successfully")

if __name__ == "__main__":
    asyncio.run(test_oauth())