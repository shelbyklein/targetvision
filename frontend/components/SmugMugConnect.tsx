'use client'

import { useState, useEffect } from 'react'
import { Camera, CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react'
import axios from 'axios'

interface SmugMugUser {
  username: string
  name?: string
  email?: string
  connected_at: string
}

export default function SmugMugConnect() {
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [user, setUser] = useState<SmugMugUser | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Check connection status on mount
  useEffect(() => {
    checkConnectionStatus()
  }, [])

  const checkConnectionStatus = async () => {
    try {
      const response = await axios.get('http://localhost:7050/api/auth/smugmug/status')
      setIsConnected(response.data.connected)
      
      if (response.data.connected) {
        // Get user details
        const userResponse = await axios.get('http://localhost:7050/api/auth/smugmug/user')
        setUser(userResponse.data)
      }
    } catch (error) {
      console.error('Failed to check connection status:', error)
    }
  }

  const handleConnect = async () => {
    setIsConnecting(true)
    setError(null)
    
    try {
      // Get authorization URL from backend
      const response = await axios.get('http://localhost:7050/api/auth/smugmug/connect')
      const { auth_url, state } = response.data
      
      // Store state in localStorage for callback verification
      localStorage.setItem('smugmug_oauth_state', state)
      
      // Open OAuth popup
      const width = 600
      const height = 700
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2
      
      const authWindow = window.open(
        auth_url,
        'SmugMug Authorization',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      )
      
      // Poll for window closure and check status
      const checkInterval = setInterval(async () => {
        if (authWindow && authWindow.closed) {
          clearInterval(checkInterval)
          setIsConnecting(false)
          
          // Check if connection was successful
          await checkConnectionStatus()
        }
      }, 1000)
      
      // Also listen for postMessage from callback page
      window.addEventListener('message', handleOAuthMessage)
      
    } catch (error: any) {
      console.error('Connection failed:', error)
      setError(error.response?.data?.detail || 'Failed to connect to SmugMug')
      setIsConnecting(false)
    }
  }

  const handleOAuthMessage = async (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return
    
    if (event.data.type === 'smugmug_connected') {
      setIsConnecting(false)
      setIsConnected(true)
      
      // Get user details
      await checkConnectionStatus()
      
      // Start initial sync
      syncPhotos()
    } else if (event.data.type === 'smugmug_error') {
      setError(event.data.message || 'OAuth authentication failed')
      setIsConnecting(false)
    }
    
    // Clean up listener
    window.removeEventListener('message', handleOAuthMessage)
  }

  const handleDisconnect = async () => {
    try {
      await axios.post('http://localhost:7050/api/auth/smugmug/disconnect')
      setIsConnected(false)
      setUser(null)
      setError(null)
    } catch (error: any) {
      console.error('Disconnect failed:', error)
      setError('Failed to disconnect from SmugMug')
    }
  }

  const syncPhotos = async () => {
    setIsSyncing(true)
    
    try {
      // This endpoint will be implemented later
      await axios.post('http://localhost:7050/api/smugmug/sync')
      
      // Refresh gallery or show success message
      console.log('Photos synced successfully')
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-center mb-6">
          <Camera className="h-12 w-12 text-primary-600 dark:text-primary-400" />
        </div>
        
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-gray-100">
          SmugMug Integration
        </h2>
        
        {!isConnected ? (
          <div className="space-y-6">
            <p className="text-center text-gray-600 dark:text-gray-400">
              Connect your SmugMug account to import and process your photo library with AI-powered descriptions and search.
            </p>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                What happens when you connect:
              </h3>
              <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 mt-0.5 mr-2 flex-shrink-0" />
                  <span>Your photos remain on SmugMug - we only read metadata</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 mt-0.5 mr-2 flex-shrink-0" />
                  <span>AI generates searchable descriptions for each photo</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 mt-0.5 mr-2 flex-shrink-0" />
                  <span>You can review and edit all AI-generated metadata</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 mt-0.5 mr-2 flex-shrink-0" />
                  <span>Disconnect anytime to remove access</span>
                </li>
              </ul>
            </div>
            
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
              </div>
            )}
            
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Camera className="h-5 w-5" />
                  Connect SmugMug Account
                </>
              )}
            </button>
            
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              You'll be redirected to SmugMug to authorize access.
              We only request read permissions for your photos.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="font-semibold text-green-900 dark:text-green-100">
                      Connected to SmugMug
                    </p>
                    {user && (
                      <p className="text-sm text-green-700 dark:text-green-300">
                        @{user.username}
                      </p>
                    )}
                  </div>
                </div>
                <a
                  href={`https://${user?.username}.smugmug.com`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                >
                  <ExternalLink className="h-5 w-5" />
                </a>
              </div>
            </div>
            
            {user && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Username</span>
                  <span className="text-gray-900 dark:text-gray-100">{user.username}</span>
                </div>
                {user.name && (
                  <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">Name</span>
                    <span className="text-gray-900 dark:text-gray-100">{user.name}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Connected</span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {new Date(user.connected_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              <button
                onClick={syncPhotos}
                disabled={isSyncing}
                className="w-full px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Syncing Photos...
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
                    Sync Photos Now
                  </>
                )}
              </button>
              
              <button
                onClick={handleDisconnect}
                className="w-full px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <XCircle className="h-4 w-4" />
                Disconnect SmugMug
              </button>
            </div>
            
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              Disconnecting will remove access but preserve any generated metadata.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}