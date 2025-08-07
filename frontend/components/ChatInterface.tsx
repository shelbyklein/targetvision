'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { chatAPI } from '../lib/api'
import { wsService } from '../lib/websocket-singleton'

interface Photo {
  id: string
  filename: string
  url: string
  description: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  photos?: Photo[]
  timestamp: Date
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [useWebSocket, setUseWebSocket] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (useWebSocket) {
      // Connect to WebSocket (singleton service handles everything)
      wsService.connect()

      const handleMessage = (data: any) => {
        if (data.type === 'assistant') {
          const assistantMessage: Message = {
            id: data.id,
            role: 'assistant',
            content: data.content,
            photos: data.photos,
            timestamp: new Date(data.timestamp),
          }
          setMessages(prev => [...prev, assistantMessage])
          setIsLoading(false)
          if (data.session_id) {
            setSessionId(data.session_id)
          }
        }
      }

      wsService.onMessage(handleMessage)

      return () => {
        wsService.removeMessageHandler(handleMessage)
        // Don't disconnect - singleton manages its own lifecycle
      }
    }
  }, [useWebSocket])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      if (useWebSocket && wsService.isConnected()) {
        wsService.sendMessage(input, sessionId || undefined)
      } else {
        const response = await chatAPI.sendMessage(input, sessionId || undefined)
        
        const assistantMessage: Message = {
          id: response.data.message_id,
          role: 'assistant',
          content: response.data.response,
          photos: response.data.photos,
          timestamp: new Date(response.data.timestamp),
        }
        
        setMessages(prev => [...prev, assistantMessage])
        
        if (response.data.session_id) {
          setSessionId(response.data.session_id)
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <p className="text-lg mb-2">Welcome to TargetVision!</p>
            <p>Start by asking about your photos or uploading new ones.</p>
            <div className="mt-4 space-y-2 text-sm">
              <p>Try asking:</p>
              <p className="italic">"Show me photos from last summer"</p>
              <p className="italic">"Find pictures with dogs"</p>
              <p className="italic">"Where are my sunset photos?"</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-4 ${
                  message.role === 'user'
                    ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-900 dark:text-primary-100'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.photos && message.photos.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {message.photos.map((photo) => (
                      <div key={photo.id} className="relative group">
                        <img
                          src={photo.url}
                          alt={photo.filename}
                          className="rounded-lg w-full h-32 object-cover"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded-lg flex items-end p-2">
                          <p className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity line-clamp-2">
                            {photo.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
              <Loader2 className="animate-spin h-5 w-5 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask about your photos..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 placeholder-gray-500 dark:placeholder-gray-400"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}