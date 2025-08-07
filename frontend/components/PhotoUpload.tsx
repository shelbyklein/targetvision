'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react'
import { photoAPI } from '../lib/api'

interface UploadedFile {
  file: File
  preview: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

export default function PhotoUpload() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      status: 'pending' as const,
    }))
    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  })

  const uploadFiles = async () => {
    setIsUploading(true)
    
    for (let i = 0; i < files.length; i++) {
      const uploadFile = files[i]
      if (uploadFile.status !== 'pending') continue

      setFiles(prev => prev.map((f, idx) => 
        idx === i ? { ...f, status: 'uploading' } : f
      ))

      const formData = new FormData()
      formData.append('file', uploadFile.file)

      try {
        await photoAPI.upload(uploadFile.file)

        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'success' } : f
        ))
      } catch (error) {
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { 
            ...f, 
            status: 'error', 
            error: 'Upload failed' 
          } : f
        ))
      }
    }

    setIsUploading(false)
  }

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev]
      URL.revokeObjectURL(newFiles[index].preview)
      newFiles.splice(index, 1)
      return newFiles
    })
  }

  const clearAll = () => {
    files.forEach(f => URL.revokeObjectURL(f.preview))
    setFiles([])
  }

  return (
    <div className="space-y-6">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive 
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' 
            : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500 bg-white dark:bg-gray-900'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
        {isDragActive ? (
          <p className="text-lg text-primary-600 dark:text-primary-400">Drop the photos here...</p>
        ) : (
          <>
            <p className="text-lg text-gray-700 dark:text-gray-300">
              Drag & drop photos here, or click to select
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Supports: JPEG, PNG, GIF, WebP (max 10MB per file)
            </p>
          </>
        )}
      </div>

      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Selected Photos ({files.length})
            </h3>
            <div className="space-x-2">
              <button
                onClick={clearAll}
                className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={uploadFiles}
                disabled={isUploading || files.every(f => f.status !== 'pending')}
                className="px-4 py-2 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isUploading ? 'Uploading...' : 'Upload All'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {files.map((file, index) => (
              <div key={index} className="relative group">
                <img
                  src={file.preview}
                  alt={file.file.name}
                  className="w-full h-40 object-cover rounded-lg"
                />
                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={() => removeFile(index)}
                    className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                {file.status !== 'pending' && (
                  <div className="absolute top-2 right-2">
                    {file.status === 'uploading' && (
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
                    )}
                    {file.status === 'success' && (
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    )}
                    {file.status === 'error' && (
                      <AlertCircle className="h-6 w-6 text-red-500" />
                    )}
                  </div>
                )}
                
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 truncate">
                  {file.file.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}