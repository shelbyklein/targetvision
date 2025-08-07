'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle } from 'lucide-react'

export default function SmugMugSuccess() {
  const searchParams = useSearchParams()
  const username = searchParams.get('username')

  useEffect(() => {
    // Notify parent window if in popup
    if (window.opener) {
      window.opener.postMessage(
        { 
          type: 'smugmug_connected',
          username: username 
        },
        window.location.origin
      )
      
      // Close popup after a short delay
      setTimeout(() => {
        window.close()
      }, 2000)
    }
  }, [username])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Successfully Connected!
          </h1>
          {username && (
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Connected as @{username}
            </p>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-500">
            This window will close automatically...
          </p>
        </div>
      </div>
    </div>
  )
}