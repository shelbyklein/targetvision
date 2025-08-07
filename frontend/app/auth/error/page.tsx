'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { XCircle } from 'lucide-react'

export default function AuthError() {
  const searchParams = useSearchParams()
  const message = searchParams.get('message') || 'Authentication failed'

  useEffect(() => {
    // Notify parent window if in popup
    if (window.opener) {
      window.opener.postMessage(
        { 
          type: 'smugmug_error',
          message: message 
        },
        window.location.origin
      )
      
      // Close popup after a delay
      setTimeout(() => {
        window.close()
      }, 3000)
    }
  }, [message])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900 dark:to-red-800">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Connection Failed
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {message}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            This window will close automatically...
          </p>
        </div>
      </div>
    </div>
  )
}