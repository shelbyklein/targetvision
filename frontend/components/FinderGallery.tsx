'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronRight, Folder, FolderOpen, Image, Search, Grid, List, ChevronDown } from 'lucide-react'
import axios from 'axios'
import FolderTree from './FolderTree'
import AlbumGrid from './AlbumGrid'
import PhotoViewer from './PhotoViewer'

interface NodeInfo {
  node_id: string
  parent_id: string | null
  name: string
  type: 'Folder' | 'Album'
  path: string
  level: number
  album_key?: string
  url_path?: string
  description?: string
  image_count?: number
  thumbnail_url?: string
  children: NodeInfo[]
}

interface BreadcrumbItem {
  name: string
  node_id: string
}

export default function FinderGallery() {
  const [treeData, setTreeData] = useState<NodeInfo | null>(null)
  const [selectedNode, setSelectedNode] = useState<NodeInfo | null>(null)
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([])
  const [isConnected, setIsConnected] = useState(false)

  // Check if SmugMug is connected
  useEffect(() => {
    const checkConnection = () => {
      const user = localStorage.getItem('smugmug_user')
      setIsConnected(!!user)
    }
    
    checkConnection()
    
    // Listen for connection events
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'smugmug_connected') {
        setIsConnected(true)
        loadGalleryTree()
      }
    }
    
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Load gallery tree on mount (will show demo data if not connected)
  useEffect(() => {
    loadGalleryTree()
  }, [])

  const loadGalleryTree = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/gallery/tree`)
      
      if (response.data.success && response.data.tree) {
        setTreeData(response.data.tree)
        
        // Auto-expand root node
        if (response.data.tree.node_id) {
          setExpandedNodes(new Set([response.data.tree.node_id]))
        }
      }
    } catch (err: any) {
      console.error('Failed to load gallery tree:', err)
      // Handle 401 error specifically
      if (err.response?.status === 401) {
        setError('Please connect your SmugMug account to view your photo gallery.')
        setIsConnected(false)
      } else {
        setError(err.response?.data?.detail || 'Failed to load gallery.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleNodeSelect = async (node: NodeInfo) => {
    setSelectedNode(node)
    
    // If it's an album, set it as selected album
    if (node.type === 'Album' && node.album_key) {
      setSelectedAlbum(node.album_key)
    } else {
      setSelectedAlbum(null)
    }
    
    // Update breadcrumb
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/gallery/breadcrumb/${node.node_id}`
      )
      if (response.data.success) {
        setBreadcrumb(response.data.path)
      }
    } catch (err) {
      console.error('Failed to get breadcrumb:', err)
    }
  }

  const handleNodeToggle = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
      }
      return newSet
    })
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/gallery/search`,
        { params: { query: searchQuery } }
      )
      
      if (response.data.success && response.data.results.length > 0) {
        // Select first result
        const firstResult = response.data.results[0]
        // You might want to expand the path to this node
        // For now, just log the results
        console.log('Search results:', response.data.results)
      }
    } catch (err) {
      console.error('Search failed:', err)
    }
  }

  const handleSync = async () => {
    setIsLoading(true)
    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/gallery/sync`)
      if (response.data.success) {
        // Reload the tree after sync
        await loadGalleryTree()
      }
    } catch (err) {
      console.error('Sync failed:', err)
      setError('Failed to sync gallery')
    } finally {
      setIsLoading(false)
    }
  }

  // Removed the connection check - will show demo data when not connected

  return (
    <div className="flex flex-col h-[calc(100vh-300px)] bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header Bar */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 text-sm">
          <button
            onClick={() => setSelectedNode(treeData)}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            Gallery
          </button>
          {breadcrumb.slice(1).map((item, index) => (
            <div key={item.node_id} className="flex items-center space-x-2">
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <button
                onClick={() => {
                  // Find and select node
                  // This would need a helper function to find node by ID
                }}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                {item.name}
              </button>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-2">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search..."
              className="pl-8 pr-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            <Search className="absolute left-2 top-1.5 w-4 h-4 text-gray-400" />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-md">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1 ${viewMode === 'grid' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
              title="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1 ${viewMode === 'list' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={isLoading}
            className="px-3 py-1 text-sm bg-primary-600 dark:bg-primary-500 text-white rounded-md hover:bg-primary-700 dark:hover:bg-primary-600 disabled:opacity-50"
          >
            {isLoading ? 'Syncing...' : 'Sync'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Folder Tree */}
        <div className="w-1/3 min-w-[250px] max-w-[400px] border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          {isLoading && !treeData ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading gallery...</p>
              </div>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-600 dark:text-red-400">
              <p className="text-sm">{error}</p>
              <button
                onClick={loadGalleryTree}
                className="mt-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                Try again
              </button>
            </div>
          ) : treeData ? (
            <FolderTree
              data={treeData}
              selectedNode={selectedNode}
              expandedNodes={expandedNodes}
              onNodeSelect={handleNodeSelect}
              onNodeToggle={handleNodeToggle}
            />
          ) : null}
        </div>

        {/* Right Panel - Content Area */}
        <div className="flex-1 overflow-y-auto">
          {selectedAlbum ? (
            // Show photos if an album is selected
            <PhotoViewer albumKey={selectedAlbum} albumName={selectedNode?.name} />
          ) : selectedNode ? (
            // Show albums/folders in the selected folder
            <AlbumGrid
              node={selectedNode}
              viewMode={viewMode}
              onAlbumSelect={(albumKey) => setSelectedAlbum(albumKey)}
            />
          ) : (
            // Empty state
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <Folder className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Select a folder to view its contents</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}