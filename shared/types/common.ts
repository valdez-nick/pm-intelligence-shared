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
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description?: string;
  stakeholders: Stakeholder[];
  status: 'active' | 'on-hold' | 'completed' | 'cancelled';
}

// Meeting Intelligence Types
export interface ActionItem {
  id: string;
  description: string;
  assignee?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

export interface MeetingAnalysis {
  id: string;
  meetingType: 'standup' | 'sprint_planning' | 'retrospective' | 'general';
  participants: Stakeholder[];
  actionItems: ActionItem[];
  summary: string;
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

// Workflow Types
export interface WorkflowStep {
  id: string;
  name: string;
  type: 'analysis' | 'transformation' | 'integration' | 'notification';
  service: 'assistant-mcp' | 'platform-core' | 'external';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
}

export interface Workflow {
  id: string;
  name: string;
  type: 'meeting_intelligence' | 'sprint_planning' | 'prd_generation' | 'stakeholder_comms';
  steps: WorkflowStep[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
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