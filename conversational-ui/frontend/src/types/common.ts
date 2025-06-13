// Common type definitions to replace generic any types

// Generic JSON-serializable value
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray
export interface JsonObject {
  [key: string]: JsonValue
}
export interface JsonArray extends Array<JsonValue> {}

// API Error Details
export interface ErrorDetails {
  code?: string
  field?: string
  reason?: string
  suggestion?: string
  metadata?: JsonObject
}

// Context types for conversations and workflows
export interface ConversationContext {
  sessionId?: string
  userId?: string
  organizationId?: string
  metadata?: JsonObject
}

export interface WorkflowContext {
  executionId?: string
  userId?: string
  priority?: 'low' | 'medium' | 'high'
  tags?: string[]
  metadata?: JsonObject
}

// Artifact types for conversation responses
export interface ConversationArtifact {
  type: 'file' | 'link' | 'code' | 'image' | 'document'
  name: string
  content?: string
  url?: string
  mimeType?: string
  size?: number
  metadata?: JsonObject
}

// Step result types for workflows
export interface StepResult {
  stepId: string
  status: 'pending' | 'running' | 'success' | 'failure' | 'skipped'
  output?: JsonObject
  error?: string
  startTime?: string
  endTime?: string
  duration?: number
}

// Analysis result types
export interface AnalysisResult {
  summary?: string
  insights?: string[]
  recommendations?: string[]
  metrics?: Record<string, number>
  entities?: Array<{
    type: string
    value: string
    confidence?: number
  }>
  metadata?: JsonObject
}

// Service details type
export interface ServiceDetails {
  version?: string
  uptime?: number
  lastCheck?: string
  metrics?: Record<string, number>
}

// Input/Output schema types
export interface SchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description?: string
  required?: boolean
  default?: JsonValue
  enum?: JsonValue[]
  properties?: Record<string, SchemaProperty>
  items?: SchemaProperty
}

export interface IOSchema {
  type: 'object'
  properties: Record<string, SchemaProperty>
  required?: string[]
}

// Workflow parameter types
export interface WorkflowParam {
  name: string
  value: JsonValue
  type?: string
  description?: string
}

// Generic paginated response
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}