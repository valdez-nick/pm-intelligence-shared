// API Types matching the FastAPI backend

import type { JsonObject, ErrorDetails, ConversationContext, ConversationArtifact, StepResult, AnalysisResult, ServiceDetails, IOSchema, WorkflowParam, WorkflowContext } from './common'

export interface APIError {
  message: string
  details: ErrorDetails | ErrorDetails[]
  path: string
  method: string
}

export interface APIResponse<T = unknown> {
  success: boolean
  data?: T
  error?: APIError
  timestamp: string
}

// Health Check Types
export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded'
  response_time_ms: number
  details: ServiceDetails
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
  context?: ConversationContext
}

export interface ConversationResponse {
  session_id: string
  message: string
  response: string
  timestamp: string
  tools_used: string[]
  artifacts?: ConversationArtifact[]
}

export interface SessionInfo {
  session_id: string
  created_at: string
  last_activity: string
  message_count: number
  context: ConversationContext
}

// Workflow Types
export interface WorkflowDefinition {
  id: string
  name: string
  description: string
  version: string
  inputs: IOSchema
  outputs: IOSchema
  steps: WorkflowStep[]
}

export interface WorkflowStep {
  id: string
  type: string
  params: WorkflowParam[]
  depends_on: string[]
  retry?: number
  timeout?: number
  condition?: string
  on_failure?: string
}

export interface WorkflowExecutionRequest {
  workflow_id: string
  inputs: JsonObject
  user_context?: WorkflowContext
}

export interface WorkflowExecutionResponse {
  execution_id: string
  workflow_id: string
  status: string
  started_at: string
  completed_at?: string
  results?: JsonObject
  error?: string
}

export interface WorkflowStatus {
  execution_id: string
  status: string
  progress: number
  current_step?: string
  completed_steps: string[]
  step_results?: Record<string, StepResult>
  results?: JsonObject
  error?: string
}

export interface WorkflowProgress {
  progress: number
  currentStep: string
  status: string
  stepResults?: StepResult[]
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
  analysis_results: AnalysisResult
  jira_tickets: JiraTicket[]
  confluence_pages: ConfluencePage[]
  execution_time: number
  success: boolean
  errors?: string[]
}

// Chat Message Types
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  tools_used?: string[]
  artifacts?: ConversationArtifact[]
  status?: 'sending' | 'sent' | 'error'
}

// UI State Types
export interface UIState {
  isLoading: boolean
  error?: string
  sessionId?: string
  isConnected: boolean
}