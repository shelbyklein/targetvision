'use client'

import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, Download, Maximize2, Info } from 'lucide-react'
import axios from 'axios'

interface Photo {
  image_key: string
  file_name: string
  caption?: string
  keywords?: string[]
  date_taken?: string
  thumbnail_url?: string
  medium_url?: string
  large_url?: string
  original_url?: string
  width?: number
  height?: number
}

interface PhotoViewerProps {
  albumKey: string
  albumName?: string
}

export default function PhotoViewer({ albumKey, albumName }: PhotoViewerProps) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const [isLoading, setIsLoading] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  useEffect(() => {
    if (albumKey) {
      fetchAlbumPhotos()
    }
  }, [albumKey])

  const fetchAlbumPhotos = async () => {
    setIsLoading(true)
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/gallery/album/${albumKey}/images`
      )
      
      if (response.data.success) {
        setPhotos(response.data.images)
      }
    } catch (err) {
      console.error('Failed to fetch album photos:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePhotoClick = (photo: Photo, index: number) => {
    setSelectedPhoto(photo)
    setSelectedIndex(index)
  }

  const handlePrevious = () => {
    if (selectedIndex > 0) {
      setSelectedPhoto(photos[selectedIndex - 1])
      setSelectedIndex(selectedIndex - 1)
    }
  }

  const handleNext = () => {
    if (selectedIndex < photos.length - 1) {
      setSelectedPhoto(photos[selectedIndex + 1])
      setSelectedIndex(selectedIndex + 1)
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!selectedPhoto) return
    
    if (e.key === 'ArrowLeft') handlePrevious()
    if (e.key === 'ArrowRight') handleNext()
    if (e.key === 'Escape') setSelectedPhoto(null)
    if (e.key === 'i') setShowInfo(!showInfo)
  }

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedPhoto, selectedIndex, showInfo])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading photos...</p>
        </div>
      </div>
    )
  }

  if (photos.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <Maximize2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No photos in this album</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Photo Grid */}
      <div className="p-4">
        {albumName && (
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {albumName} ({photos.length} photos)
          </h2>
        )}
        
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {photos.map((photo, index) => (
            <div
              key={photo.image_key}
              onClick={() => handlePhotoClick(photo, index)}
              className="relative aspect-square bg-gray-100 dark:bg-gray-800 rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all group"
            >
              {photo.thumbnail_url ? (
                <img
                  src={photo.thumbnail_url}
                  alt={photo.caption || photo.file_name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Maximize2 className="w-8 h-8 text-gray-400" />
                </div>
              )}
              
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center opacity-0 group-hover:opacity-100">
                <Maximize2 className="text-white h-6 w-6" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
          {/* Close button */}
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
          >
            <X className="w-8 h-8" />
          </button>

          {/* Navigation buttons */}
          {selectedIndex > 0 && (
            <button
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 z-10"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}
          
          {selectedIndex < photos.length - 1 && (
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 z-10"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}

          {/* Controls */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center space-x-4 z-10">
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="p-2 bg-black bg-opacity-50 text-white rounded hover:bg-opacity-70"
              title="Toggle info (I)"
            >
              <Info className="w-5 h-5" />
            </button>
            
            {selectedPhoto.original_url && (
              <a
                href={selectedPhoto.original_url}
                download={selectedPhoto.file_name}
                className="p-2 bg-black bg-opacity-50 text-white rounded hover:bg-opacity-70"
                title="Download"
              >
                <Download className="w-5 h-5" />
              </a>
            )}
            
            <span className="text-white text-sm">
              {selectedIndex + 1} / {photos.length}
            </span>
          </div>

          {/* Main image */}
          <div className="max-w-full max-h-full p-8">
            <img
              src={selectedPhoto.large_url || selectedPhoto.medium_url || selectedPhoto.thumbnail_url}
              alt={selectedPhoto.caption || selectedPhoto.file_name}
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* Info panel */}
          {showInfo && (
            <div className="absolute top-0 right-0 w-80 h-full bg-black bg-opacity-80 text-white p-6 overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">Photo Information</h3>
              
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-400">File Name</p>
                  <p>{selectedPhoto.file_name}</p>
                </div>
                
                {selectedPhoto.caption && (
                  <div>
                    <p className="text-gray-400">Caption</p>
                    <p>{selectedPhoto.caption}</p>
                  </div>
                )}
                
                {selectedPhoto.date_taken && (
                  <div>
                    <p className="text-gray-400">Date Taken</p>
                    <p>{new Date(selectedPhoto.date_taken).toLocaleString()}</p>
                  </div>
                )}
                
                {selectedPhoto.width && selectedPhoto.height && (
                  <div>
                    <p className="text-gray-400">Dimensions</p>
                    <p>{selectedPhoto.width} × {selectedPhoto.height}</p>
                  </div>
                )}
                
                {selectedPhoto.keywords && selectedPhoto.keywords.length > 0 && (
                  <div>
                    <p className="text-gray-400">Keywords</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedPhoto.keywords.map((keyword, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-gray-700 rounded-md text-xs"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}