import { useRef, useState } from 'react'
import { UploadedFileInfo } from '@/lib/types'
import { getUploadSessionId, isAllowedVideoFile, uploadVideo } from '@/lib/api'

interface UseVideoUploadOptions {
  youtubeUrl: string
  onUploaded: (info: UploadedFileInfo) => void
  onError?: (message: string) => void
}

/** State + handler untuk zona upload video (klik, drag & drop, progress, error). */
export function useVideoUpload({ youtubeUrl, onUploaded, onError }: UseVideoUploadOptions) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (file: File) => {
    setUploadError(null)

    if (!isAllowedVideoFile(file)) {
      setUploadError('Format tidak didukung. Gunakan: MP4, MKV, MOV, AVI, WEBM')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const uploadData = await uploadVideo(file, getUploadSessionId(youtubeUrl), setUploadProgress)
      setUploadProgress(100)
      onUploaded(uploadData)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload gagal'
      setUploadError(message)
      setUploadProgress(0)
      onError?.(message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const resetUpload = () => {
    setUploadError(null)
    setUploadProgress(0)
  }

  return {
    isUploading, uploadProgress, uploadError, isDragging, fileInputRef,
    handleFileUpload, handleDrop, handleDragOver, handleDragLeave, resetUpload,
  }
}
