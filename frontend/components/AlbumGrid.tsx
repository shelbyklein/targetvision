'use client'

import { useState, useEffect } from 'react'
import { Folder, FolderOpen, Image as ImageIcon, Calendar, Hash } from 'lucide-react'
import axios from 'axios'

interface NodeInfo {
  node_id: string
  name: string
  type: 'Folder' | 'Album'
  path: string
  album_key?: string
  image_count?: number
  thumbnail_url?: string
  description?: string
  children: NodeInfo[]
}

interface AlbumGridProps {
  node: NodeInfo
  viewMode: 'grid' | 'list'
  onAlbumSelect: (albumKey: string) => void
}

export default function AlbumGrid({ node, viewMode, onAlbumSelect }: AlbumGridProps) {
  const [items, setItems] = useState<NodeInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Use children from the node if available
    if (node.children) {
      setItems(node.children)
    } else {
      // Otherwise fetch children from API
      fetchNodeChildren()
    }
  }, [node])

  const fetchNodeChildren = async () => {
    if (!node.node_id) return
    
    setIsLoading(true)
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/gallery/node/${node.node_id}/children`
      )
      
      if (response.data.success) {
        setItems(response.data.children)
      }
    } catch (err) {
      console.error('Failed to fetch node children:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleItemClick = (item: NodeInfo) => {
    if (item.type === 'Album' && item.album_key) {
      onAlbumSelect(item.album_key)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <Folder className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">This folder is empty</p>
        </div>
      </div>
    )
  }

  if (viewMode === 'list') {
    return (
      <div className="p-4">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">Name</th>
              <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">Type</th>
              <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">Photos</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.node_id}
                onClick={() => handleItemClick(item)}
                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
              >
                <td className="py-2 px-3">
                  <div className="flex items-center">
                    {item.type === 'Folder' ? (
                      <Folder className="w-4 h-4 mr-2 text-yellow-600 dark:text-yellow-500" />
                    ) : (
                      <ImageIcon className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-500" />
                    )}
                    <span className="text-sm text-gray-900 dark:text-gray-100">{item.name}</span>
                  </div>
                </td>
                <td className="py-2 px-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{item.type}</span>
                </td>
                <td className="py-2 px-3">
                  {item.type === 'Album' && item.image_count !== undefined && (
                    <span className="text-sm text-gray-600 dark:text-gray-400">{item.image_count}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // Grid View
  return (
    <div className="p-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {items.map((item) => (
          <div
            key={item.node_id}
            onClick={() => handleItemClick(item)}
            className="group cursor-pointer"
          >
            <div className="relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-primary-500 transition-all">
              {item.thumbnail_url ? (
                <img
                  src={item.thumbnail_url}
                  alt={item.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    const placeholder = e.currentTarget.nextElementSibling as HTMLElement
                    if (placeholder) placeholder.style.display = 'flex'
                  }}
                />
              ) : null}
              
              {/* Placeholder for items without thumbnails */}
              <div
                className={`${item.thumbnail_url ? 'hidden' : 'flex'} absolute inset-0 items-center justify-center`}
              >
                {item.type === 'Folder' ? (
                  <Folder className="w-16 h-16 text-yellow-600 dark:text-yellow-500 opacity-50" />
                ) : (
                  <ImageIcon className="w-16 h-16 text-blue-600 dark:text-blue-500 opacity-50" />
                )}
              </div>

              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity" />
              
              {/* Badge for photo count */}
              {item.type === 'Album' && item.image_count !== undefined && item.image_count > 0 && (
                <div className="absolute top-2 right-2 px-2 py-1 bg-black bg-opacity-50 text-white text-xs rounded">
                  {item.image_count} photos
                </div>
              )}
            </div>
            
            {/* Item name and info */}
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {item.name}
              </p>
              {item.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {item.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}