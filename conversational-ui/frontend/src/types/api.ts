// API Types matching the FastAPI backend

export interface APIError {
  message: string
  details: Record<string, any>
  path: string
  method: string
}

export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: APIError
  timestamp: string
}

// Health Check Types
export interface ServiceHealth {
  status: string
  response_time_ms: number
  details: Record<string, any>
}

export interface HealthStatus {
  status: string
  timestamp: string
  version: string
  services: Record<string, ServiceHealth>
}

// Conversation Types
export interface ConversationRequest {
  message: string
  session_id?: string
  context?: Record<string, any>
}

export interface ConversationResponse {
  session_id: string
  message: string
  response: string
  timestamp: string
  tools_used: string[]
  artifacts?: Record<string, any>
}

export interface SessionInfo {
  session_id: string
  created_at: string
  last_activity: string
  message_count: number
  context: Record<string, any>
}

// Workflow Types
export interface WorkflowDefinition {
  id: string
  name: string
  description: string
  version: string
  inputs: Record<string, any>
  outputs: Record<string, any>
  steps: WorkflowStep[]
}

export interface WorkflowStep {
  id: string
  type: string
  params: Record<string, any>
  depends_on: string[]
  retry?: number
  timeout?: number
  condition?: string
  on_failure?: string
}

export interface WorkflowExecutionRequest {
  workflow_id: string
  inputs: Record<string, any>
  user_context?: Record<string, any>
}

export interface WorkflowExecutionResponse {
  execution_id: string
  workflow_id: string
  status: string
  started_at: string
  completed_at?: string
  results?: Record<string, any>
  error?: string
}

export interface WorkflowStatus {
  execution_id: string
  status: string
  progress: number
  current_step?: string
  completed_steps: string[]
  step_results?: Record<string, any>
  results?: Record<string, any>
  error?: string
}

export interface WorkflowProgress {
  progress: number
  currentStep: string
  status: string
  stepResults?: any
  executionId?: string
}

// Meeting Intelligence specific types
export interface MeetingIntelligenceInput {
  transcript: string
  project_key: string
  participants: string[]
  meeting_title?: string
  assignee?: string
  meeting_type?: 'sprint_planning' | 'retrospective' | 'standup' | 'planning' | 'review' | 'general'
  duration_minutes?: number
  date?: string
}

export interface JiraTicket {
  key: string
  summary: string
  description: string
  url: string
}

export interface ConfluencePage {
  id: string
  title: string
  url: string
}

export interface MeetingIntelligenceOutput {
  workflow_id: string
  analysis_results: Record<string, any>
  jira_tickets: JiraTicket[]
  confluence_pages: ConfluencePage[]
  execution_time: number
  success: boolean
  errors?: string[]
}

// Document Source Information
export interface DocumentSource {
  doc_id: string
  title: string
  content_preview: string
  file_type?: string
  collection: string
  similarity_score: number
  url?: string
  tags?: string[]
  created_at?: string
}

// Chat Message Types
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  tools_used?: string[]
  artifacts?: Record<string, any>
  status?: 'sending' | 'sent' | 'error'
  document_sources?: DocumentSource[]
  rag_metadata?: {
    total_sources: number
    retrieval_time_ms: number
    strategy_used: string
  }
}

// UI State Types
export interface UIState {
  isLoading: boolean
  error?: string
  sessionId?: string
  isConnected: boolean
}