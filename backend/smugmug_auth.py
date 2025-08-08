import hashlib
import hmac
import time
import urllib.parse
import base64
import secrets
from typing import Dict, Optional, Tuple
import httpx
from config import settings
import logging

logger = logging.getLogger(__name__)

class SmugMugOAuth:
    """OAuth 1.0a implementation for SmugMug API"""
    
    def __init__(self):
        self.api_key = settings.SMUGMUG_API_KEY
        self.api_secret = settings.SMUGMUG_API_SECRET
        self.callback_url = settings.SMUGMUG_CALLBACK_URL
        
    def _generate_nonce(self) -> str:
        """Generate a random nonce for OAuth"""
        return secrets.token_hex(16)
    
    def _generate_timestamp(self) -> str:
        """Generate current timestamp"""
        return str(int(time.time()))
    
    def _percent_encode(self, value: str) -> str:
        """Percent encode a string per OAuth 1.0a spec"""
        return urllib.parse.quote(str(value), safe='')
    
    def _create_signature_base_string(self, method: str, url: str, params: Dict[str, str]) -> str:
        """Create the signature base string for OAuth"""
        # Sort parameters by key
        sorted_params = sorted(params.items())
        
        # Create parameter string
        param_string = '&'.join([f"{k}={v}" for k, v in sorted_params])
        
        # Create base string
        base_string = f"{method.upper()}&{self._percent_encode(url)}&{self._percent_encode(param_string)}"
        return base_string
    
    def _sign_request(self, method: str, url: str, params: Dict[str, str], 
                     token_secret: str = "") -> str:
        """Generate OAuth signature for request"""
        # Create signing key
        signing_key = f"{self._percent_encode(self.api_secret)}&{self._percent_encode(token_secret)}"
        
        # Create base string
        base_string = self._create_signature_base_string(method, url, params)
        
        # Generate signature
        signature = hmac.new(
            signing_key.encode('utf-8'),
            base_string.encode('utf-8'),
            hashlib.sha1
        ).digest()
        
        # Base64 encode the signature
        return base64.b64encode(signature).decode('utf-8')
    
    async def get_request_token(self) -> Optional[Dict[str, str]]:
        """Step 1: Get request token from SmugMug"""
        url = settings.SMUGMUG_REQUEST_TOKEN_URL
        
        # OAuth parameters
        oauth_params = {
            "oauth_callback": self._percent_encode(self.callback_url),
            "oauth_consumer_key": self.api_key,
            "oauth_nonce": self._generate_nonce(),
            "oauth_signature_method": "HMAC-SHA1",
            "oauth_timestamp": self._generate_timestamp(),
            "oauth_version": "1.0",
        }
        
        # Generate signature
        signature = self._sign_request("GET", url, oauth_params)
        oauth_params["oauth_signature"] = self._percent_encode(signature)
        
        # Create Authorization header
        auth_header = "OAuth " + ", ".join([f'{k}="{v}"' for k, v in oauth_params.items()])
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    url,
                    headers={"Authorization": auth_header}
                )
                
                if response.status_code == 200:
                    # Parse response
                    token_data = urllib.parse.parse_qs(response.text)
                    return {
                        "oauth_token": token_data["oauth_token"][0],
                        "oauth_token_secret": token_data["oauth_token_secret"][0],
                        "oauth_callback_confirmed": token_data.get("oauth_callback_confirmed", ["false"])[0]
                    }
                else:
                    logger.error(f"Failed to get request token: {response.status_code} - {response.text}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error getting request token: {e}")
            return None
    
    def get_authorization_url(self, request_token: str) -> str:
        """Step 2: Get URL for user to authorize the app"""
        return f"{settings.SMUGMUG_AUTHORIZE_URL}?oauth_token={request_token}&Access=Full&Permissions=Read"
    
    async def get_access_token(self, request_token: str, request_token_secret: str, 
                               oauth_verifier: str) -> Optional[Dict[str, str]]:
        """Step 3: Exchange request token for access token"""
        url = settings.SMUGMUG_ACCESS_TOKEN_URL
        
        # OAuth parameters
        oauth_params = {
            "oauth_consumer_key": self.api_key,
            "oauth_nonce": self._generate_nonce(),
            "oauth_signature_method": "HMAC-SHA1",
            "oauth_timestamp": self._generate_timestamp(),
            "oauth_token": request_token,
            "oauth_verifier": oauth_verifier,
            "oauth_version": "1.0",
        }
        
        # Generate signature with request token secret
        signature = self._sign_request("GET", url, oauth_params, request_token_secret)
        oauth_params["oauth_signature"] = self._percent_encode(signature)
        
        # Create Authorization header
        auth_header = "OAuth " + ", ".join([f'{k}="{v}"' for k, v in oauth_params.items()])
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    url,
                    headers={"Authorization": auth_header}
                )
                
                if response.status_code == 200:
                    # Parse response
                    token_data = urllib.parse.parse_qs(response.text)
                    return {
                        "oauth_token": token_data["oauth_token"][0],
                        "oauth_token_secret": token_data["oauth_token_secret"][0],
                        "user_id": token_data.get("oauth_token_user_nsid", [""])[0],
                        "username": token_data.get("oauth_token_user_nickname", [""])[0]
                    }
                else:
                    logger.error(f"Failed to get access token: {response.status_code} - {response.text}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error getting access token: {e}")
            return None
    
    async def make_authenticated_request(self, method: str, url: str, 
                                        access_token: str, access_token_secret: str,
                                        params: Optional[Dict] = None,
                                        headers: Optional[Dict] = None) -> Optional[httpx.Response]:
        """Make an authenticated request to SmugMug API"""
        if params is None:
            params = {}
        if headers is None:
            headers = {}
            
        # Add Accept header for JSON responses
        headers["Accept"] = "application/json"
        
        # OAuth parameters
        oauth_params = {
            "oauth_consumer_key": self.api_key,
            "oauth_nonce": self._generate_nonce(),
            "oauth_signature_method": "HMAC-SHA1",
            "oauth_timestamp": self._generate_timestamp(),
            "oauth_token": access_token,
            "oauth_version": "1.0",
        }
        
        # Combine OAuth params with request params for signature
        all_params = {**oauth_params}
        if method.upper() == "GET" and params:
            # For GET requests, include query params in signature
            for k, v in params.items():
                all_params[k] = str(v)
        
        # Generate signature
        signature = self._sign_request(method, url, all_params, access_token_secret)
        oauth_params["oauth_signature"] = self._percent_encode(signature)
        
        # Create Authorization header
        auth_header = "OAuth " + ", ".join([f'{k}="{v}"' for k, v in oauth_params.items()])
        headers["Authorization"] = auth_header
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                if method.upper() == "GET":
                    response = await client.get(url, params=params, headers=headers)
                elif method.upper() == "POST":
                    response = await client.post(url, json=params, headers=headers)
                else:
                    raise ValueError(f"Unsupported method: {method}")
                
                return response
                
        except Exception as e:
            logger.error(f"Error making authenticated request: {e}")
            return None