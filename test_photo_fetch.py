#!/usr/bin/env python3
"""
Test fetching photos from SmugMug
"""

import asyncio
import sys
sys.path.append('backend')

from database import SessionLocal
from models import OAuthToken
from smugmug_auth import SmugMugOAuth
import json

async def test_photos():
    """Test fetching photos from an album"""
    db = SessionLocal()
    token = db.query(OAuthToken).filter_by(service="smugmug").first()
    db.close()
    
    if not token:
        print("No token found")
        return
        
    oauth = SmugMugOAuth()
    
    # Test getting images from a specific album
    album_uri = "/api/v2/album/X9BpR5"  # U18/U21 awards album
    
    # Try with the full URI
    print(f"Testing album: {album_uri}")
    
    # Method 1: Direct API call with full URL
    url = f"https://api.smugmug.com{album_uri}!images"
    print(f"URL: {url}")
    
    response = await oauth.make_authenticated_request(
        "GET", url, token.access_token, token.access_token_secret,
        params={"count": "2", "_expand": "ImageSizes"}
    )
    
    if response:
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            images = data.get("Response", {}).get("AlbumImage", [])
            print(f"Found {len(images)} images")
            for img in images:
                print(f"  - {img.get('FileName')}")
                if "ImageSizes" in img:
                    sizes = img["ImageSizes"]
                    for size_key in ["Large", "Medium", "Small"]:
                        if size_key in sizes:
                            print(f"    {size_key}: {sizes[size_key].get('Url', 'N/A')}")
                            break
        else:
            print(f"Error: {response.text[:500]}")
    else:
        print("No response")

if __name__ == "__main__":
    asyncio.run(test_photos())