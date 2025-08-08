'use client'

import { ChevronRight, ChevronDown, Folder, FolderOpen, Image } from 'lucide-react'

interface NodeInfo {
  node_id: string
  parent_id: string | null
  name: string
  type: 'Folder' | 'Album'
  path: string
  level: number
  album_key?: string
  image_count?: number
  children: NodeInfo[]
}

interface FolderTreeProps {
  data: NodeInfo
  selectedNode: NodeInfo | null
  expandedNodes: Set<string>
  onNodeSelect: (node: NodeInfo) => void
  onNodeToggle: (nodeId: string) => void
}

function TreeNode({
  node,
  selectedNode,
  expandedNodes,
  onNodeSelect,
  onNodeToggle,
  level = 0
}: {
  node: NodeInfo
  selectedNode: NodeInfo | null
  expandedNodes: Set<string>
  onNodeSelect: (node: NodeInfo) => void
  onNodeToggle: (nodeId: string) => void
  level?: number
}) {
  const isExpanded = expandedNodes.has(node.node_id)
  const isSelected = selectedNode?.node_id === node.node_id
  const hasChildren = node.children && node.children.length > 0
  const isFolder = node.type === 'Folder'

  return (
    <div>
      <div
        className={`
          flex items-center px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800
          ${isSelected ? 'bg-primary-100 dark:bg-primary-900/30' : ''}
        `}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={() => {
          onNodeSelect(node)
          if (isFolder && hasChildren) {
            onNodeToggle(node.node_id)
          }
        }}
      >
        {/* Expand/Collapse Icon */}
        {isFolder && hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onNodeToggle(node.node_id)
            }}
            className="mr-1 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>
        ) : (
          <span className="w-5 mr-1" />
        )}

        {/* Folder/Album Icon */}
        <span className="mr-2">
          {isFolder ? (
            isExpanded ? (
              <FolderOpen className="w-4 h-4 text-yellow-600 dark:text-yellow-500" />
            ) : (
              <Folder className="w-4 h-4 text-yellow-600 dark:text-yellow-500" />
            )
          ) : (
            <Image className="w-4 h-4 text-blue-600 dark:text-blue-500" />
          )}
        </span>

        {/* Node Name */}
        <span className={`
          text-sm flex-1 truncate
          ${isSelected ? 'font-semibold text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'}
        `}>
          {node.name}
        </span>

        {/* Album Count Badge */}
        {node.type === 'Album' && node.image_count !== undefined && (
          <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
            {node.image_count}
          </span>
        )}
      </div>

      {/* Children */}
      {isFolder && isExpanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.node_id}
              node={child}
              selectedNode={selectedNode}
              expandedNodes={expandedNodes}
              onNodeSelect={onNodeSelect}
              onNodeToggle={onNodeToggle}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function FolderTree({
  data,
  selectedNode,
  expandedNodes,
  onNodeSelect,
  onNodeToggle
}: FolderTreeProps) {
  return (
    <div className="py-2">
      <TreeNode
        node={data}
        selectedNode={selectedNode}
        expandedNodes={expandedNodes}
        onNodeSelect={onNodeSelect}
        onNodeToggle={onNodeToggle}
      />
    </div>
  )
}