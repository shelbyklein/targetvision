'use client'

import { useState } from 'react'
import { Camera, MessageSquare, Search, Image as ImageIcon } from 'lucide-react'
import Image from 'next/image'
import ChatInterface from '@/components/ChatInterface'
import SmugMugConnect from '@/components/SmugMugConnect'
import PhotoGallery from '@/components/PhotoGallery'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'chat' | 'smugmug' | 'gallery'>('chat')

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="text-center mb-8 relative">
        <div className="absolute right-0 top-0">
          <ThemeToggle />
        </div>
        <div className="flex items-center justify-center gap-4 mb-2">
          <div className="w-20 h-20 relative">
            <Image 
              src="/targetvision-logo.svg" 
              alt="TargetVision Logo" 
              fill
              className="drop-shadow-lg object-contain"
              priority
              unoptimized
            />
          </div>
          <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">
            TargetVision
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          AI-powered photo search and chat
        </p>
      </header>

      <div className="max-w-6xl mx-auto">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden">
          <nav className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 px-6 py-4 flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'chat'
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              <MessageSquare size={20} />
              <span>Chat & Search</span>
            </button>
            <button
              onClick={() => setActiveTab('smugmug')}
              className={`flex-1 px-6 py-4 flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'smugmug'
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              <Camera size={20} />
              <span>SmugMug</span>
            </button>
            <button
              onClick={() => setActiveTab('gallery')}
              className={`flex-1 px-6 py-4 flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'gallery'
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              <ImageIcon size={20} />
              <span>Gallery</span>
            </button>
          </nav>

          <div className="p-6">
            {activeTab === 'chat' && <ChatInterface />}
            {activeTab === 'smugmug' && <SmugMugConnect />}
            {activeTab === 'gallery' && <PhotoGallery />}
          </div>
        </div>
      </div>
    </main>
  )
}