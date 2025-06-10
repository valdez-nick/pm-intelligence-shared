/**
 * Shared type definitions for PM Intelligence Platform
 * Used across assistant-mcp, platform-core, and web-ui
 */

// Core PM Entities
export interface Stakeholder {
  id: string;
  name: string;
  email?: string;
  role: string;
  team?: string;
  responsibilities?: string[];
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description?: string;
  stakeholders: Stakeholder[];
  status: 'active' | 'on-hold' | 'completed' | 'cancelled';
  startDate?: string;
  endDate?: string;
}

export interface Epic {
  id: string;
  key: string;
  title: string;
  description?: string;
  projectId: string;
  status: 'open' | 'in-progress' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  storyPoints?: number;
}

// OKR Types
export interface KeyResult {
  id: string;
  description: string;
  target: number;
  current: number;
  unit: string;
  status: 'on-track' | 'at-risk' | 'off-track' | 'completed';
}

export interface Objective {
  id: string;
  title: string;
  description?: string;
  keyResults: KeyResult[];
  timeframe: string;
  owner: Stakeholder;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
}

// Meeting Intelligence Types
export interface ActionItem {
  id: string;
  description: string;
  assignee?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  source?: string; // meeting ID or context
}

export interface Decision {
  id: string;
  description: string;
  rationale?: string;
  decidedBy: string[];
  decidedOn: string;
  impact: 'low' | 'medium' | 'high';
  category?: string;
}

export interface MeetingAnalysis {
  id: string;
  meetingType: 'standup' | 'sprint_planning' | 'retrospective' | 'general';
  participants: Stakeholder[];
  actionItems: ActionItem[];
  decisions: Decision[];
  summary: string;
  keyTopics: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  timestamp: string;
}

// WSJF Types
export interface WSJFScore {
  businessValue: number;
  customerValue: number;
  strategicAlignment: number;
  timeCriticality: number;
  riskReduction: number;
  effort: number;
  wsjfScore: number;
  priorityRank?: number;
}

export interface BacklogItem {
  id: string;
  title: string;
  description: string;
  type: 'story' | 'epic' | 'bug' | 'task';
  storyPoints?: number;
  projectKey: string;
  epicId?: string;
  status: 'open' | 'in-progress' | 'done';
  wsjfScore?: WSJFScore;
  assignee?: string;
  labels?: string[];
}

// Workflow Types
export interface WorkflowInput {
  [key: string]: any;
}

export interface WorkflowOutput {
  [key: string]: any;
}

export interface WorkflowContext {
  workflowId: string;
  userId: string;
  userRole: string[];
  projectContext?: Project;
  timestamp: string;
  metadata: Record<string, any>;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'analysis' | 'transformation' | 'integration' | 'notification';
  service: 'assistant-mcp' | 'platform-core' | 'external';
  input: WorkflowInput;
  output?: WorkflowOutput;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: string;
  endTime?: string;
  error?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  type: 'meeting_intelligence' | 'sprint_planning' | 'prd_generation' | 'stakeholder_comms';
  steps: WorkflowStep[];
  input: WorkflowInput;
  output?: WorkflowOutput;
  context: WorkflowContext;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  startTime: string;
  endTime?: string;
  error?: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  metadata?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: 'workflow_progress' | 'workflow_completed' | 'error' | 'ping' | 'pong';
  workflowId?: string;
  data: any;
  timestamp: string;
}

// Configuration Types
export interface ServiceConfig {
  name: string;
  version: string;
  port: number;
  host: string;
  healthEndpoint: string;
}

export interface DatabaseConfig {
  type: 'sqlite' | 'postgresql' | 'mysql';
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  ssl?: boolean;
}

export interface CredentialConfig {
  service: string;
  type: 'api_token' | 'oauth' | 'basic_auth';
  credentials: Record<string, string>;
  expiresAt?: string;
}

export interface UnifiedConfig {
  services: {
    assistantMcp: ServiceConfig;
    platformCore: ServiceConfig;
    apiGateway: ServiceConfig;
    webUI: ServiceConfig;
  };
  database: DatabaseConfig;
  credentials: CredentialConfig[];
  features: {
    auditLogging: boolean;
    realTimeUpdates: boolean;
    caching: boolean;
    rateLimiting: boolean;
  };
  integrations: {
    jira?: {
      url: string;
      enabled: boolean;
    };
    confluence?: {
      url: string;
      enabled: boolean;
    };
    obsidian?: {
      vaultPath: string;
      enabled: boolean;
    };
  };
}

// Utility Types
export type Status = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type UserRole = 'admin' | 'pm' | 'developer' | 'stakeholder' | 'readonly';

// Event Types for Inter-Service Communication
export interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  aggregateType: string;
  data: Record<string, any>;
  metadata: {
    timestamp: string;
    version: number;
    causationId?: string;
    correlationId?: string;
    userId?: string;
  };
}

export interface WorkflowEvent extends DomainEvent {
  type: 'workflow.started' | 'workflow.completed' | 'workflow.failed' | 'workflow.step.completed';
  aggregateType: 'workflow';
  data: {
    workflowId: string;
    stepId?: string;
    progress?: number;
    result?: any;
    error?: string;
  };
}

export interface MeetingEvent extends DomainEvent {
  type: 'meeting.analyzed' | 'meeting.action_items.created' | 'meeting.decisions.recorded';
  aggregateType: 'meeting';
  data: {
    meetingId: string;
    actionItems?: ActionItem[];
    decisions?: Decision[];
    analysis?: MeetingAnalysis;
  };
}

// Error Types
export class PMIntelligenceError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'PMIntelligenceError';
  }
}

export class ValidationError extends PMIntelligenceError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class ServiceUnavailableError extends PMIntelligenceError {
  constructor(service: string, details?: Record<string, any>) {
    super(`Service ${service} is unavailable`, 'SERVICE_UNAVAILABLE', { service, ...details });
    this.name = 'ServiceUnavailableError';
  }
}

export class WorkflowExecutionError extends PMIntelligenceError {
  constructor(workflowId: string, stepId: string, message: string, details?: Record<string, any>) {
    super(message, 'WORKFLOW_EXECUTION_ERROR', { workflowId, stepId, ...details });
    this.name = 'WorkflowExecutionError';
  }
}