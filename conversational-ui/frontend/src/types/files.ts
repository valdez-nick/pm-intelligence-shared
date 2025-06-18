/**
 * File upload related types and interfaces
 */

export enum EntityType {
  DOCUMENT = 'document',
  ATTACHMENT = 'attachment',
  IMAGE = 'image',
  REPORT = 'report',
  DATASET = 'dataset'
}

export enum ProcessingType {
  TEXT_EXTRACTION = 'text_extraction',
  MALWARE_SCAN = 'malware_scan',
  CDR = 'cdr',
  EMBEDDING = 'embedding',
  SUMMARIZATION = 'summarization'
}

export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface FileUploadOptions {
  entityType?: EntityType
  entityId?: string
  metadata?: Record<string, any>
  priority?: number
  tags?: string[]
  description?: string
}

export interface FileUploadResponse {
  fileId: string
  originalName: string
  storedName: string
  fileHash: string
  fileSize: number
  mimeType: string
  uploadDate: string
  cdnUrl?: string
  processingJobs: ProcessingJob[]
}

export interface ProcessingJob {
  jobId: string
  processType: ProcessingType
  status: ProcessingStatus
  priority: number
  createdAt: string
}

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
  speed: number // bytes per second
  remainingTime: number // seconds
}

export interface UploadingFile {
  id: string
  file: File
  progress: UploadProgress
  status: 'pending' | 'uploading' | 'paused' | 'cancelled' | 'completed' | 'failed'
  error?: string
  response?: FileUploadResponse
  startTime: number
  chunks?: ChunkProgress[]
}

export interface ChunkProgress {
  index: number
  size: number
  uploaded: boolean
  progress: number
}

export interface FileListItem {
  id: string
  originalName: string
  fileSize: number
  mimeType: string
  uploadDate: string
  entityType?: EntityType
  entityId?: string
  tags: string[]
  processingStatus: Record<ProcessingType, ProcessingStatus>
  cdnUrl?: string
  metadata?: Record<string, any>
}

export interface FileFilters {
  tenantId?: string
  userId?: string
  entityType?: EntityType
  entityId?: string
  mimeType?: string
  tags?: string[]
  uploadDateFrom?: Date
  uploadDateTo?: Date
  minSize?: number
  maxSize?: number
  isDeleted?: boolean
  limit?: number
  offset?: number
}

export interface FileListResponse {
  files: FileListItem[]
  total: number
  hasMore: boolean
}

export interface FileProcessingUpdate {
  fileId: string
  processType: ProcessingType
  status: ProcessingStatus
  progress?: number
  error?: string
  result?: any
  completedAt?: string
}

export interface FileUploadError {
  fileId?: string
  fileName: string
  error: string
  code?: string
  retryable: boolean
}

// Utility types
export type ProgressCallback = (progress: UploadProgress) => void
export type FileValidator = (file: File) => { valid: boolean; error?: string }

// Constants
export const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024 // 5GB
export const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB

export const ACCEPTED_FILE_TYPES = {
  documents: {
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    'text/plain': ['.txt'],
    'text/markdown': ['.md'],
    'text/csv': ['.csv']
  },
  images: {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/svg+xml': ['.svg'],
    'image/webp': ['.webp']
  },
  archives: {
    'application/zip': ['.zip'],
    'application/x-rar-compressed': ['.rar'],
    'application/x-tar': ['.tar'],
    'application/gzip': ['.gz']
  }
}

export const FILE_ICONS: Record<string, string> = {
  'application/pdf': '📄',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-excel': '📊',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
  'application/vnd.ms-powerpoint': '📊',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '📊',
  'text/plain': '📃',
  'text/markdown': '📑',
  'text/csv': '📊',
  'image/jpeg': '🖼️',
  'image/png': '🖼️',
  'image/gif': '🖼️',
  'image/svg+xml': '🖼️',
  'application/zip': '📦',
  'default': '📎'
}