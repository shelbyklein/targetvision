'use client'

import { useState, useEffect } from 'react'
import { Search, Filter, Download, Maximize2, ImageIcon } from 'lucide-react'
import Image from 'next/image'
import axios from 'axios'

interface Photo {
  id: string
  url: string
  thumbnail: string
  description: string
  uploadedAt: string
  album?: string
}

export default function PhotoGallery() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchAllPhotos = async () => {
    setIsLoading(true)
    try {
      const response = await axios.get('/api/photos/list')
      const photoList = response.data.photos.map((photo: any) => ({
        id: photo.id,
        url: photo.url,
        thumbnail: photo.thumbnail || photo.url,
        description: photo.description || 'No description',
        uploadedAt: photo.uploaded_at ? new Date(photo.uploaded_at).toLocaleDateString() : 'Unknown',
        album: photo.album || 'General'
      }))
      setPhotos(photoList)
    } catch (error) {
      console.error('Error fetching photos:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const searchPhotos = async () => {
    if (!searchQuery.trim()) {
      fetchAllPhotos()
      return
    }

    setIsLoading(true)
    try {
      const response = await axios.get('/api/photos/search', {
        params: { query: searchQuery }
      })
      const photoList = response.data.results.map((photo: any) => ({
        id: photo.id,
        url: photo.url,
        thumbnail: photo.thumbnail || photo.url,
        description: photo.description || 'No description',
        uploadedAt: photo.uploaded_at ? new Date(photo.uploaded_at).toLocaleDateString() : 'Unknown',
        album: photo.album || 'General'
      }))
      setPhotos(photoList)
    } catch (error) {
      console.error('Error searching photos:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Load all photos on mount
  useEffect(() => {
    fetchAllPhotos()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchPhotos()}
            placeholder="Search photos using natural language..."
            className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 placeholder-gray-500 dark:placeholder-gray-400"
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500" />
        </div>
        <button
          onClick={searchPhotos}
          disabled={isLoading}
          className="px-6 py-2 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
        <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300">
          <Filter size={20} />
        </button>
      </div>

      {photos.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p className="text-lg mb-2">No photos found</p>
          <p className="text-sm">Try searching or uploading some photos first</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative cursor-pointer"
              onClick={() => setSelectedPhoto(photo)}
            >
              <div className="relative w-full h-48 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                {photo.thumbnail ? (
                  <img
                    src={photo.thumbnail}
                    alt={photo.description}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`${photo.thumbnail ? 'hidden' : ''} absolute inset-0 flex items-center justify-center`}>
                  <ImageIcon className="w-16 h-16 text-gray-400 dark:text-gray-600" />
                </div>
              </div>
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                <Maximize2 className="text-white h-8 w-8" />
              </div>
              <div className="mt-2">
                <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {photo.description}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {photo.album} • {photo.uploadedAt}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-lg max-w-4xl max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Photo Details</h3>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <div className="relative w-full min-h-[300px] bg-gray-100 dark:bg-gray-800 rounded-lg mb-4">
                {selectedPhoto.url ? (
                  <img
                    src={selectedPhoto.url}
                    alt={selectedPhoto.description}
                    className="w-full h-auto rounded-lg"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`${selectedPhoto.url ? 'hidden' : ''} absolute inset-0 flex items-center justify-center`}>
                  <ImageIcon className="w-24 h-24 text-gray-400 dark:text-gray-600" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-gray-700 dark:text-gray-300">{selectedPhoto.description}</p>
                <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <span>Album: {selectedPhoto.album}</span>
                  <span>Uploaded: {selectedPhoto.uploadedAt}</span>
                </div>
                <button className="mt-4 px-4 py-2 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600 flex items-center gap-2">
                  <Download size={16} />
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}