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
  results?: Record<string, any>
  error?: string
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
}

// UI State Types
export interface UIState {
  isLoading: boolean
  error?: string
  sessionId?: string
  isConnected: boolean
}