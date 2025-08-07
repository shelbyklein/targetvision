'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [message, setMessage] = useState('Completing authorization...')

  useEffect(() => {
    const handleCallback = async () => {
      const oauthToken = searchParams.get('oauth_token')
      const oauthVerifier = searchParams.get('oauth_verifier')
      const state = searchParams.get('state')
      
      if (!oauthToken || !oauthVerifier) {
        setStatus('error')
        setMessage('Missing OAuth parameters')
        return
      }

      try {
        // Send the OAuth token and verifier to the backend to complete the flow
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/smugmug/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            oauth_token: oauthToken,
            oauth_verifier: oauthVerifier,
            state: state,
          }),
        })

        if (!response.ok) {
          throw new Error(`Failed to complete OAuth: ${response.statusText}`)
        }

        const data = await response.json()
        
        // Store the user info in localStorage or state management
        if (data.user) {
          localStorage.setItem('smugmug_user', JSON.stringify(data.user))
        }
        
        setStatus('success')
        setMessage('Successfully connected to SmugMug!')
        
        // Redirect to home page after a short delay
        setTimeout(() => {
          router.push('/')
        }, 2000)
      } catch (error) {
        console.error('OAuth callback error:', error)
        setStatus('error')
        setMessage(error instanceof Error ? error.message : 'Failed to complete authorization')
      }
    }

    handleCallback()
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 max-w-md w-full">
        <div className="flex flex-col items-center space-y-4">
          {status === 'processing' && (
            <>
              <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Processing...
              </h2>
            </>
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle className="h-12 w-12 text-green-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Success!
              </h2>
            </>
          )}
          
          {status === 'error' && (
            <>
              <XCircle className="h-12 w-12 text-red-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Error
              </h2>
            </>
          )}
          
          <p className="text-gray-600 dark:text-gray-400 text-center">
            {message}
          </p>
          
          {status === 'error' && (
            <button
              onClick={() => router.push('/')}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Return Home
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SmugMugCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
      </div>
    }>
      <CallbackContent />
    </Suspense>
  )
}