"""SmugMug OAuth 1.0a Authentication Service"""

import os
import secrets
import hashlib
import hmac
import base64
import time
from urllib.parse import quote, urlencode, parse_qs
from typing import Dict, Tuple, Optional
import httpx
from authlib.integrations.httpx_client import OAuth1Auth
from cryptography.fernet import Fernet
import logging

logger = logging.getLogger(__name__)


class SmugMugOAuth:
    """Handle SmugMug OAuth 1.0a authentication flow"""
    
    def __init__(self):
        self.api_key = os.getenv('SMUGMUG_API_KEY')
        self.api_secret = os.getenv('SMUGMUG_API_SECRET')
        self.callback_url = os.getenv('SMUGMUG_CALLBACK_URL', 'http://localhost:3000/auth/smugmug/callback')
        
        if not self.api_key or not self.api_secret:
            raise ValueError("SmugMug API credentials not configured")
        
        # OAuth 1.0a endpoints
        self.request_token_url = 'https://secure.smugmug.com/services/oauth/1.0a/getRequestToken'
        self.authorize_url = 'https://secure.smugmug.com/services/oauth/1.0a/authorize'
        self.access_token_url = 'https://secure.smugmug.com/services/oauth/1.0a/getAccessToken'
        
        # Initialize encryption for token storage
        encryption_key = os.getenv('ENCRYPTION_KEY')
        if encryption_key:
            self.cipher = Fernet(encryption_key.encode() if isinstance(encryption_key, str) else encryption_key)
        else:
            # Generate a key for development
            self.cipher = Fernet(Fernet.generate_key())
            logger.warning("Using generated encryption key - set ENCRYPTION_KEY in production")
    
    async def get_request_token(self) -> Dict[str, str]:
        """
        Step 1: Get request token from SmugMug
        Returns dict with oauth_token and oauth_token_secret
        """
        # OAuth1Auth will include the callback in the OAuth signature
        oauth_auth = OAuth1Auth(
            client_id=self.api_key,
            client_secret=self.api_secret,
            redirect_uri=self.callback_url
        )
        
        try:
            async with httpx.AsyncClient() as client:
                # Don't add oauth_callback as a separate param - it's included in OAuth signature
                response = await client.post(
                    self.request_token_url,
                    auth=oauth_auth
                )
                response.raise_for_status()
                
                # Parse the response
                token_data = parse_qs(response.text)
                token = {
                    'oauth_token': token_data['oauth_token'][0],
                    'oauth_token_secret': token_data['oauth_token_secret'][0],
                    'oauth_callback_confirmed': token_data.get('oauth_callback_confirmed', ['false'])[0]
                }
                
                logger.info(f"Request token obtained: {token.get('oauth_token')[:10]}...")
                return token
            
        except Exception as e:
            logger.error(f"Failed to get request token: {e}")
            raise
    
    def get_authorization_url(self, request_token: str, state: Optional[str] = None) -> str:
        """
        Step 2: Build authorization URL for user
        Note: OAuth 1.0a doesn't support state parameter
        """
        params = {
            'oauth_token': request_token,
            'Access': 'Full',  # Request full access
            'Permissions': 'Read',  # Read-only permissions
            # Don't include state - OAuth 1.0a doesn't support it
        }
        
        auth_url = f"{self.authorize_url}?{urlencode(params)}"
        logger.info(f"Authorization URL generated: {auth_url[:50]}...")
        
        # Return state for compatibility, but it won't be in the callback
        return auth_url, state
    
    async def exchange_token(
        self, 
        oauth_token: str, 
        oauth_verifier: str,
        request_token_secret: str
    ) -> Dict[str, str]:
        """
        Step 3: Exchange request token for access token
        Returns dict with oauth_token and oauth_token_secret
        """
        # Include verifier in OAuth1Auth initialization
        oauth_auth = OAuth1Auth(
            client_id=self.api_key,
            client_secret=self.api_secret,
            token=oauth_token,
            token_secret=request_token_secret,
            verifier=oauth_verifier
        )
        
        try:
            async with httpx.AsyncClient() as client:
                # Don't add oauth_verifier as a separate param - it's included in OAuth signature
                response = await client.post(
                    self.access_token_url,
                    auth=oauth_auth
                )
                response.raise_for_status()
                
                # Parse the response
                token_data = parse_qs(response.text)
                token = {
                    'oauth_token': token_data['oauth_token'][0],
                    'oauth_token_secret': token_data['oauth_token_secret'][0]
                }
                
                logger.info("Access token obtained successfully")
                return token
            
        except Exception as e:
            logger.error(f"Failed to exchange token: {e}")
            raise
    
    def encrypt_token(self, token: str) -> str:
        """Encrypt OAuth token for storage"""
        return self.cipher.encrypt(token.encode()).decode()
    
    def decrypt_token(self, encrypted_token: str) -> str:
        """Decrypt OAuth token for use"""
        return self.cipher.decrypt(encrypted_token.encode()).decode()
    
    def create_oauth_session(self, access_token: str, access_token_secret: str) -> OAuth1Auth:
        """
        Create authenticated OAuth session for API calls
        """
        return OAuth1Auth(
            client_id=self.api_key,
            client_secret=self.api_secret,
            token=access_token,
            token_secret=access_token_secret
        )


class SmugMugTokenStorage:
    """Handle secure storage of OAuth tokens"""
    
    def __init__(self, db_session):
        self.db = db_session
        self.oauth = SmugMugOAuth()
    
    async def store_request_token(
        self, 
        user_id: str,
        oauth_token: str,
        oauth_token_secret: str,
        state: str
    ) -> None:
        """Store request token temporarily during OAuth flow"""
        # Store in Redis or temporary table with TTL
        # For now, using in-memory storage (should use Redis in production)
        pass
    
    async def get_request_token(self, state: str) -> Optional[Dict[str, str]]:
        """Retrieve request token by state"""
        # Retrieve from Redis or temporary storage
        pass
    
    async def store_access_token(
        self,
        user_id: str,
        access_token: str,
        access_token_secret: str
    ) -> None:
        """Store encrypted access tokens for user"""
        encrypted_token = self.oauth.encrypt_token(access_token)
        encrypted_secret = self.oauth.encrypt_token(access_token_secret)
        
        # Store in database
        # user.smugmug_access_token = encrypted_token
        # user.smugmug_access_secret = encrypted_secret
        # user.smugmug_connected = True
        # self.db.commit()
    
    async def get_access_token(self, user_id: str) -> Optional[Tuple[str, str]]:
        """Get decrypted access tokens for user"""
        # Retrieve from database and decrypt
        # user = self.db.query(User).filter_by(id=user_id).first()
        # if user and user.smugmug_connected:
        #     token = self.oauth.decrypt_token(user.smugmug_access_token)
        #     secret = self.oauth.decrypt_token(user.smugmug_access_secret)
        #     return token, secret
        return None
    
    async def delete_tokens(self, user_id: str) -> None:
        """Remove OAuth tokens when disconnecting"""
        # user = self.db.query(User).filter_by(id=user_id).first()
        # if user:
        #     user.smugmug_access_token = None
        #     user.smugmug_access_secret = None
        #     user.smugmug_connected = False
        #     self.db.commit()
        pass