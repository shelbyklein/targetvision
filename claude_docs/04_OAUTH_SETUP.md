# SmugMug OAuth Setup Guide

## Overview
This guide covers the complete OAuth 2.0 setup process for integrating SmugMug API with TargetVision, including registration, implementation, and security best practices.

---

## Prerequisites

### 1. SmugMug Account Requirements
- Active SmugMug subscription (Power or higher recommended)
- Account with photos and albums to test
- Admin access to create API applications

### 2. Development Environment
- Python 3.8+ with FastAPI
- HTTPS capability (ngrok for local development)
- Environment variable management (.env files)

---

## Step 1: Register Application with SmugMug

### 1.1 Get API Credentials
1. Visit [SmugMug API Application](https://api.smugmug.com/api/developer/apply)
2. Fill out the application form:
   - **Application Name**: TargetVision
   - **Description**: AI-powered photo search and metadata management
   - **Type**: Web Application
   - **OAuth Callback URL**: 
     - Development: `http://localhost:3000/auth/smugmug/callback`
     - Production: `https://yourdomain.com/auth/smugmug/callback`

### 1.2 Store Credentials
Once approved, you'll receive:
```env
# .env file
SMUGMUG_API_KEY=your_api_key_here
SMUGMUG_API_SECRET=your_api_secret_here
SMUGMUG_CALLBACK_URL=http://localhost:3000/auth/smugmug/callback
```

---

## Step 2: OAuth Flow Implementation

### 2.1 Backend OAuth Service

Create `backend/services/smugmug_auth.py`:

```python
import os
import secrets
from urllib.parse import urlencode
from authlib.integrations.starlette_client import OAuth
from fastapi import HTTPException

class SmugMugOAuth:
    def __init__(self):
        self.api_key = os.getenv('SMUGMUG_API_KEY')
        self.api_secret = os.getenv('SMUGMUG_API_SECRET')
        self.callback_url = os.getenv('SMUGMUG_CALLBACK_URL')
        
        # OAuth endpoints
        self.request_token_url = 'https://secure.smugmug.com/services/oauth/1.0a/getRequestToken'
        self.authorize_url = 'https://secure.smugmug.com/services/oauth/1.0a/authorize'
        self.access_token_url = 'https://secure.smugmug.com/services/oauth/1.0a/getAccessToken'
    
    def get_authorization_url(self, state: str = None):
        """Generate OAuth authorization URL"""
        if not state:
            state = secrets.token_urlsafe(32)
        
        params = {
            'oauth_callback': self.callback_url,
            'Access': 'Full',
            'Permissions': 'Read',
            'state': state
        }
        
        # Get request token first
        request_token = self._get_request_token()
        
        # Build authorization URL
        auth_url = f"{self.authorize_url}?{urlencode(params)}&oauth_token={request_token}"
        
        return auth_url, state
    
    def exchange_token(self, oauth_token: str, oauth_verifier: str):
        """Exchange OAuth token for access token"""
        # Implementation for token exchange
        pass
    
    def refresh_token(self, refresh_token: str):
        """Refresh expired access token"""
        # Implementation for token refresh
        pass
```

### 2.2 FastAPI OAuth Endpoints

Create `backend/api/auth.py`:

```python
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from services.smugmug_auth import SmugMugOAuth

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.get("/smugmug/connect")
async def smugmug_connect(db: Session = Depends(get_db)):
    """Initiate SmugMug OAuth flow"""
    oauth = SmugMugOAuth()
    auth_url, state = oauth.get_authorization_url()
    
    # Store state in session/database for verification
    db_state = OAuthState(state=state, created_at=datetime.utcnow())
    db.add(db_state)
    db.commit()
    
    return {"auth_url": auth_url, "state": state}

@router.get("/smugmug/callback")
async def smugmug_callback(
    oauth_token: str,
    oauth_verifier: str,
    state: str,
    db: Session = Depends(get_db)
):
    """Handle SmugMug OAuth callback"""
    # Verify state to prevent CSRF
    db_state = db.query(OAuthState).filter_by(state=state).first()
    if not db_state:
        raise HTTPException(status_code=400, detail="Invalid state")
    
    # Exchange for access token
    oauth = SmugMugOAuth()
    tokens = oauth.exchange_token(oauth_token, oauth_verifier)
    
    # Store tokens securely
    user = db.query(User).filter_by(id=current_user_id).first()
    user.smugmug_access_token = encrypt(tokens['access_token'])
    user.smugmug_refresh_token = encrypt(tokens['refresh_token'])
    user.smugmug_connected = True
    db.commit()
    
    # Redirect to frontend success page
    return RedirectResponse(url="/dashboard?connected=true")

@router.post("/smugmug/disconnect")
async def smugmug_disconnect(db: Session = Depends(get_db)):
    """Disconnect SmugMug account"""
    user = db.query(User).filter_by(id=current_user_id).first()
    user.smugmug_access_token = None
    user.smugmug_refresh_token = None
    user.smugmug_connected = False
    db.commit()
    
    return {"message": "SmugMug account disconnected"}
```

---

## Step 3: Frontend Integration

### 3.1 Connect Button Component

Create `frontend/components/SmugMugConnect.tsx`:

```typescript
import { useState } from 'react'
import axios from 'axios'

export default function SmugMugConnect() {
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  
  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      const response = await axios.get('/api/auth/smugmug/connect')
      // Open OAuth popup
      const authWindow = window.open(
        response.data.auth_url,
        'SmugMug Authorization',
        'width=600,height=700'
      )
      
      // Listen for callback
      window.addEventListener('message', (event) => {
        if (event.data.type === 'smugmug_connected') {
          authWindow?.close()
          setIsConnected(true)
          // Trigger photo sync
          syncPhotos()
        }
      })
    } catch (error) {
      console.error('Connection failed:', error)
    } finally {
      setIsConnecting(false)
    }
  }
  
  const handleDisconnect = async () => {
    try {
      await axios.post('/api/auth/smugmug/disconnect')
      setIsConnected(false)
    } catch (error) {
      console.error('Disconnect failed:', error)
    }
  }
  
  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">SmugMug Connection</h3>
      
      {!isConnected ? (
        <div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Connect your SmugMug account to import and process your photos
          </p>
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {isConnecting ? 'Connecting...' : 'Connect SmugMug'}
          </button>
        </div>
      ) : (
        <div>
          <p className="text-green-600 dark:text-green-400 mb-4">
            ✓ SmugMug account connected
          </p>
          <button
            onClick={handleDisconnect}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}
```

### 3.2 Callback Handler Page

Create `frontend/app/auth/smugmug/callback/page.tsx`:

```typescript
'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function SmugMugCallback() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    
    if (connected === 'true') {
      // Notify parent window if in popup
      if (window.opener) {
        window.opener.postMessage(
          { type: 'smugmug_connected' },
          window.location.origin
        )
        window.close()
      } else {
        // Redirect to dashboard
        router.push('/dashboard?connected=true')
      }
    } else if (error) {
      // Handle error
      console.error('OAuth error:', error)
      router.push('/dashboard?error=connection_failed')
    }
  }, [])
  
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Connecting to SmugMug...</p>
      </div>
    </div>
  )
}
```

---

## Step 4: Token Management

### 4.1 Secure Token Storage

```python
# backend/services/encryption.py
from cryptography.fernet import Fernet
import os

class TokenEncryption:
    def __init__(self):
        # Generate or load encryption key
        self.key = os.getenv('ENCRYPTION_KEY', Fernet.generate_key())
        self.cipher = Fernet(self.key)
    
    def encrypt_token(self, token: str) -> str:
        """Encrypt OAuth token for storage"""
        return self.cipher.encrypt(token.encode()).decode()
    
    def decrypt_token(self, encrypted_token: str) -> str:
        """Decrypt OAuth token for use"""
        return self.cipher.decrypt(encrypted_token.encode()).decode()
```

### 4.2 Token Refresh Middleware

```python
# backend/middleware/token_refresh.py
from datetime import datetime, timedelta

class TokenRefreshMiddleware:
    async def __call__(self, request, call_next):
        # Check if token needs refresh
        user = get_current_user(request)
        if user and user.smugmug_connected:
            token_age = datetime.utcnow() - user.token_updated_at
            
            if token_age > timedelta(hours=23):  # Refresh daily
                oauth = SmugMugOAuth()
                new_tokens = oauth.refresh_token(user.smugmug_refresh_token)
                
                # Update stored tokens
                user.smugmug_access_token = encrypt(new_tokens['access_token'])
                user.token_updated_at = datetime.utcnow()
                db.commit()
        
        response = await call_next(request)
        return response
```

---

## Step 5: Testing OAuth Flow

### 5.1 Local Development with ngrok

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com

# Start local server
npm run dev  # Frontend on :3000
python backend/main.py  # Backend on :7050

# Expose local server
ngrok http 3000

# Update callback URL in .env
SMUGMUG_CALLBACK_URL=https://your-ngrok-url.ngrok.io/auth/smugmug/callback
```

### 5.2 Test Checklist

- [ ] OAuth flow initiates correctly
- [ ] SmugMug authorization page loads
- [ ] Callback handles success case
- [ ] Callback handles denial/error case
- [ ] Tokens are stored encrypted
- [ ] Token refresh works
- [ ] Disconnect removes tokens
- [ ] State parameter prevents CSRF

---

## Step 6: Production Deployment

### 6.1 Environment Configuration

```env
# Production .env
NODE_ENV=production
SMUGMUG_API_KEY=production_key
SMUGMUG_API_SECRET=production_secret
SMUGMUG_CALLBACK_URL=https://targetvision.com/auth/smugmug/callback
ENCRYPTION_KEY=generate_strong_key_here
DATABASE_ENCRYPTION=true
```

### 6.2 Security Checklist

- [ ] Use HTTPS for all OAuth endpoints
- [ ] Implement CSRF protection with state parameter
- [ ] Encrypt tokens at rest
- [ ] Use secure session management
- [ ] Implement rate limiting on auth endpoints
- [ ] Log authentication events
- [ ] Set up monitoring for failed auth attempts
- [ ] Regular security audits

---

## Troubleshooting

### Common Issues

1. **"Invalid callback URL"**
   - Ensure callback URL in app settings matches exactly
   - Include protocol (http/https)
   - Check for trailing slashes

2. **"Access denied" error**
   - User may have denied permissions
   - Check required scopes are requested
   - Verify API key is active

3. **Token refresh failing**
   - Refresh token may be expired
   - User needs to re-authenticate
   - Check token storage encryption

4. **CORS errors**
   - Add SmugMug domains to CORS whitelist
   - Use backend proxy for API calls
   - Check preflight request handling

### Debug Logging

```python
# Enable debug logging for OAuth
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger('smugmug_oauth')

# Log OAuth events
logger.debug(f"Authorization URL: {auth_url}")
logger.debug(f"Callback received: token={oauth_token}")
logger.debug(f"Token exchange successful: user={user_id}")
```

---

## References

- [SmugMug OAuth Documentation](https://api.smugmug.com/api/v2/doc/tutorial/authorization.html)
- [OAuth 2.0 RFC](https://tools.ietf.org/html/rfc6749)
- [Authlib Documentation](https://docs.authlib.org/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)