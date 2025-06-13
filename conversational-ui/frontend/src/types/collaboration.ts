// Collaboration-related types

import type { JsonObject } from './common'

export type CollaborationEventType = 
  | 'session_joined'
  | 'session_left'
  | 'agent_joined'
  | 'agent_left'
  | 'message_sent'
  | 'workflow_started'
  | 'workflow_completed'
  | 'workflow_failed'
  | 'artifact_created'
  | 'artifact_updated'
  | 'system_notification'
  | 'error'

export interface CollaborationEventData {
  eventType: CollaborationEventType
  payload: JsonObject
  metadata?: {
    source?: string
    priority?: 'low' | 'medium' | 'high'
    tags?: string[]
  }
}

export interface CollaborationMessage {
  type: string
  session_id?: string
  agent_id?: string
  organization_id?: string
  data: CollaborationEventData | any // TODO: Fix this when refactoring CollaborationView
  timestamp: string
}

export interface CollaborationSession {
  id: string
  organizationId: string
  participants: CollaborationParticipant[]
  startedAt: string
  lastActivity: string
  status: 'active' | 'paused' | 'completed'
}

export interface CollaborationParticipant {
  id: string
  type: 'user' | 'agent'
  name: string
  role?: string
  joinedAt: string
  status: 'active' | 'idle' | 'disconnected'
}

export interface CollaborationArtifact {
  id: string
  type: 'document' | 'code' | 'diagram' | 'report'
  name: string
  content?: string
  url?: string
  createdBy: string
  createdAt: string
  version: number
  metadata?: JsonObject
}