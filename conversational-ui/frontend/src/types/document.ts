export enum DocumentStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  INDEXED = 'indexed',
  FAILED = 'failed',
  ARCHIVED = 'archived',
}

export enum DocumentAccessLevel {
  PRIVATE = 'private',
  TEAM = 'team',
  ORGANIZATION = 'organization',
  PUBLIC = 'public',
}

export enum SupportedFileType {
  PDF = 'pdf',
  DOCX = 'docx',
  DOC = 'doc',
  TXT = 'txt',
  MD = 'md',
  MARKDOWN = 'markdown',
  CSV = 'csv',
  JSON = 'json',
  XML = 'xml',
  HTML = 'html',
  RTF = 'rtf',
}

export interface UserDocument {
  doc_id: string;
  filename: string;
  original_filename: string;
  file_type: SupportedFileType | null;
  title: string;
  description: string;
  content_preview: string;
  content_hash: string;
  file_size_bytes: number;
  page_count?: number;
  word_count?: number;
  status: DocumentStatus;
  processing_error?: string;
  indexed_at?: string;
  chunks_created: number;
  user_id: string;
  organization_id: string;
  access_level: DocumentAccessLevel;
  shared_with: string[];
  tags: string[];
  categories: string[];
  custom_metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  last_accessed_at?: string;
  storage_path: string;
  vector_collection: string;
  chunk_ids: string[];
  view_count: number;
  download_count: number;
  search_count: number;
}

export interface DocumentUploadRequest {
  file: File;
  title?: string;
  description?: string;
  tags?: string[];
  categories?: string[];
  access_level?: DocumentAccessLevel;
  shared_with?: string[];
  custom_metadata?: Record<string, any>;
  user_id: string;
  organization_id: string;
}

export interface DocumentUploadResult {
  success: boolean;
  document?: UserDocument;
  error?: string;
  chunks_created: number;
  processing_time_seconds: number;
}

export interface DocumentSearchRequest {
  query?: string;
  file_types?: SupportedFileType[];
  tags?: string[];
  categories?: string[];
  status?: DocumentStatus[];
  access_level?: DocumentAccessLevel[];
  created_after?: string;
  created_before?: string;
  updated_after?: string;
  updated_before?: string;
  min_file_size?: number;
  max_file_size?: number;
  page?: number;
  page_size?: number;
}

export interface DocumentSearchResult {
  documents: UserDocument[];
  total_count: number;
  page: number;
  page_size: number;
  has_more: boolean;
  search_time_seconds: number;
}

export interface DocumentUpdateRequest {
  title?: string;
  description?: string;
  tags?: string[];
  categories?: string[];
  access_level?: DocumentAccessLevel;
  shared_with?: string[];
  custom_metadata?: Record<string, any>;
}

export interface DocumentStats {
  user_documents: number;
  organization_documents: number;
  total_size_bytes: number;
  by_status: Record<string, number>;
  by_file_type: Record<string, number>;
  by_access_level: Record<string, number>;
  recent_uploads: Array<{
    doc_id: string;
    filename: string;
    created_at: string;
    status: string;
  }>;
}

export interface SupportedFileTypeInfo {
  extension: string;
  mime_types: string[];
  description: string;
}

export interface BatchUploadResult {
  success: boolean;
  message: string;
  results: Array<{
    filename: string;
    success: boolean;
    document_id?: string;
    error?: string;
    chunks_created: number;
  }>;
  summary: {
    total_files: number;
    successful: number;
    failed: number;
    total_chunks_created: number;
  };
}

export interface DocumentContent {
  doc_id: string;
  title: string;
  content_preview: string;
  file_type?: string;
  is_text_extractable: boolean;
  chunks_available: number;
  word_count: number;
  extended_preview?: string;
}