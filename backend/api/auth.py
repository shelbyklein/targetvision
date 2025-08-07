"""Authentication API endpoints for SmugMug OAuth"""

import os
import json
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import RedirectResponse, JSONResponse
from pydantic import BaseModel
import logging

# Import services (will need to update imports based on actual structure)
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.smugmug_auth import SmugMugOAuth, SmugMugTokenStorage
from services.smugmug_service import SmugMugAPI

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["authentication"])

# Temporary storage for OAuth flow (should use Redis in production)
oauth_state_storage: Dict[str, Dict[str, Any]] = {}
user_tokens: Dict[str, Dict[str, str]] = {}


class ConnectResponse(BaseModel):
    auth_url: str
    state: str


class CallbackRequest(BaseModel):
    oauth_token: str
    oauth_verifier: str
    state: str


class ConnectionStatus(BaseModel):
    connected: bool
    username: Optional[str] = None
    email: Optional[str] = None


@router.get("/smugmug/connect", response_model=ConnectResponse)
async def smugmug_connect(request: Request):
    """
    Initiate SmugMug OAuth flow
    Returns authorization URL for user to visit
    """
    try:
        oauth = SmugMugOAuth()
        
        # Step 1: Get request token
        request_token_data = await oauth.get_request_token()
        
        oauth_token = request_token_data.get('oauth_token')
        oauth_token_secret = request_token_data.get('oauth_token_secret')
        
        if not oauth_token or not oauth_token_secret:
            raise HTTPException(status_code=500, detail="Failed to get request token")
        
        # Generate state for CSRF protection
        state = secrets.token_urlsafe(32)
        
        # Step 2: Get authorization URL
        auth_url, _ = oauth.get_authorization_url(oauth_token, state)
        
        # Store request token and secret for callback (use Redis in production)
        oauth_state_storage[state] = {
            'oauth_token': oauth_token,
            'oauth_token_secret': oauth_token_secret,
            'created_at': datetime.utcnow().isoformat()
        }
        
        logger.info(f"OAuth flow initiated with state: {state[:10]}...")
        
        return ConnectResponse(auth_url=auth_url, state=state)
        
    except Exception as e:
        logger.error(f"Failed to initiate OAuth: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/smugmug/callback")
async def smugmug_callback(
    oauth_token: str,
    oauth_verifier: str,
    state: str,
    request: Request
):
    """
    Handle SmugMug OAuth callback
    Exchange request token for access token
    """
    try:
        # Verify state to prevent CSRF
        stored_data = oauth_state_storage.get(state)
        if not stored_data:
            logger.error(f"Invalid state: {state}")
            return RedirectResponse(url="/auth/error?message=Invalid+state")
        
        # Check if state is not expired (5 minutes TTL)
        created_at = datetime.fromisoformat(stored_data['created_at'])
        if datetime.utcnow() - created_at > timedelta(minutes=5):
            del oauth_state_storage[state]
            return RedirectResponse(url="/auth/error?message=State+expired")
        
        # Verify oauth_token matches
        if stored_data['oauth_token'] != oauth_token:
            logger.error("OAuth token mismatch")
            return RedirectResponse(url="/auth/error?message=Token+mismatch")
        
        oauth = SmugMugOAuth()
        
        # Step 3: Exchange for access token
        access_token_data = await oauth.exchange_token(
            oauth_token=oauth_token,
            oauth_verifier=oauth_verifier,
            request_token_secret=stored_data['oauth_token_secret']
        )
        
        access_token = access_token_data.get('oauth_token')
        access_token_secret = access_token_data.get('oauth_token_secret')
        
        if not access_token or not access_token_secret:
            raise HTTPException(status_code=500, detail="Failed to get access token")
        
        # Get user info using the access token
        api_key = os.getenv('SMUGMUG_API_KEY')
        api_secret = os.getenv('SMUGMUG_API_SECRET')
        
        smugmug_api = SmugMugAPI(
            access_token=access_token,
            access_token_secret=access_token_secret,
            api_key=api_key,
            api_secret=api_secret
        )
        
        user_info = await smugmug_api.get_authenticated_user()
        username = user_info.get('NickName', 'Unknown')
        
        # Store tokens (in production, store in database with user association)
        # For demo, using simple in-memory storage
        user_id = f"user_{username}"
        user_tokens[user_id] = {
            'access_token': oauth.encrypt_token(access_token),
            'access_token_secret': oauth.encrypt_token(access_token_secret),
            'username': username,
            'connected_at': datetime.utcnow().isoformat()
        }
        
        # Clean up state
        del oauth_state_storage[state]
        
        logger.info(f"User {username} successfully connected")
        
        # Redirect to frontend success page
        return RedirectResponse(url=f"/auth/smugmug/success?username={username}")
        
    except Exception as e:
        logger.error(f"OAuth callback failed: {e}")
        return RedirectResponse(url=f"/auth/error?message={str(e)}")


@router.post("/smugmug/callback")
async def smugmug_callback_post(callback_data: CallbackRequest):
    """
    Alternative POST endpoint for callback (for frontend handling)
    """
    try:
        # Similar logic to GET callback but returns JSON
        stored_data = oauth_state_storage.get(callback_data.state)
        if not stored_data:
            raise HTTPException(status_code=400, detail="Invalid state")
        
        oauth = SmugMugOAuth()
        
        access_token_data = await oauth.exchange_token(
            oauth_token=callback_data.oauth_token,
            oauth_verifier=callback_data.oauth_verifier,
            request_token_secret=stored_data['oauth_token_secret']
        )
        
        # Get user info
        api_key = os.getenv('SMUGMUG_API_KEY')
        api_secret = os.getenv('SMUGMUG_API_SECRET')
        
        smugmug_api = SmugMugAPI(
            access_token=access_token_data['oauth_token'],
            access_token_secret=access_token_data['oauth_token_secret'],
            api_key=api_key,
            api_secret=api_secret
        )
        
        user_info = await smugmug_api.get_authenticated_user()
        
        # Store tokens
        user_id = f"user_{user_info.get('NickName')}"
        oauth_service = SmugMugOAuth()
        user_tokens[user_id] = {
            'access_token': oauth_service.encrypt_token(access_token_data['oauth_token']),
            'access_token_secret': oauth_service.encrypt_token(access_token_data['oauth_token_secret']),
            'username': user_info.get('NickName'),
            'connected_at': datetime.utcnow().isoformat()
        }
        
        # Clean up state
        del oauth_state_storage[state]
        
        return {
            "success": True,
            "username": user_info.get('NickName'),
            "message": "Successfully connected to SmugMug"
        }
        
    except Exception as e:
        logger.error(f"OAuth callback failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/smugmug/disconnect")
async def smugmug_disconnect(request: Request):
    """
    Disconnect SmugMug account
    """
    try:
        # In production, get user from session/JWT
        # For demo, using simple approach
        
        # Clear all user tokens (in production, only clear current user's tokens)
        user_tokens.clear()
        
        return {"success": True, "message": "SmugMug account disconnected"}
        
    except Exception as e:
        logger.error(f"Failed to disconnect: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/smugmug/status", response_model=ConnectionStatus)
async def smugmug_status(request: Request):
    """
    Check SmugMug connection status
    """
    try:
        # In production, get user from session/JWT
        # For demo, check if any user is connected
        
        if user_tokens:
            # Get first user (demo only)
            user_data = list(user_tokens.values())[0]
            return ConnectionStatus(
                connected=True,
                username=user_data.get('username')
            )
        
        return ConnectionStatus(connected=False)
        
    except Exception as e:
        logger.error(f"Failed to check status: {e}")
        return ConnectionStatus(connected=False)


@router.get("/smugmug/user")
async def get_smugmug_user(request: Request):
    """
    Get authenticated SmugMug user information
    """
    try:
        # Check if user is connected
        if not user_tokens:
            raise HTTPException(status_code=401, detail="Not connected to SmugMug")
        
        # Get first user (demo only)
        user_data = list(user_tokens.values())[0]
        
        # Decrypt tokens
        oauth = SmugMugOAuth()
        access_token = oauth.decrypt_token(user_data['access_token'])
        access_token_secret = oauth.decrypt_token(user_data['access_token_secret'])
        
        # Get user info from SmugMug
        api_key = os.getenv('SMUGMUG_API_KEY')
        api_secret = os.getenv('SMUGMUG_API_SECRET')
        
        smugmug_api = SmugMugAPI(
            access_token=access_token,
            access_token_secret=access_token_secret,
            api_key=api_key,
            api_secret=api_secret
        )
        
        user_info = await smugmug_api.get_authenticated_user()
        
        return {
            "username": user_info.get('NickName'),
            "name": user_info.get('Name'),
            "email": user_info.get('Email'),
            "connected_at": user_data.get('connected_at')
        }
        
    except Exception as e:
        logger.error(f"Failed to get user info: {e}")
        raise HTTPException(status_code=500, detail=str(e))