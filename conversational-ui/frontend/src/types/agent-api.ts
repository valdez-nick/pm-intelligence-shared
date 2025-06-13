// Agent-related API types

import type { JsonObject } from './common'

export interface AgentCapability {
  name: string
  description: string
  required: boolean
  parameters?: JsonObject
}

export interface AgentConfiguration {
  id: string
  name: string
  description: string
  type: string
  version: string
  capabilities: AgentCapability[]
  settings?: JsonObject
  metadata?: JsonObject
  organization_id?: string
  role?: string
  authority_level?: number
  custom_config?: JsonObject
}

export interface AgentLimits {
  maxAgents: number
  maxFileSize: number
  allowedFileTypes: string[]
  storageQuota: number
  usedStorage: number
}

export interface AgentUploadResponse {
  success: boolean
  agentId?: string
  message: string
  agent?: AgentConfiguration
  warnings?: string[]
  data?: AgentConfiguration
}

export interface AgentListResponse {
  agents: AgentConfiguration[]
  total: number
  page: number
  pageSize: number
}

export interface AgentUpdateRequest {
  name?: string
  description?: string
  capabilities?: AgentCapability[]
  settings?: JsonObject
  metadata?: JsonObject
}

export interface AgentCreateRequest {
  name: string
  organization_id: string
  template_name?: string
  custom_config?: {
    role: string
    persona: {
      description: string
      expertise: string[]
      decision_style: string
      communication_style: string
      priorities: string[]
      constraints: string[]
      system_prompt: string
    }
    capability_ids: string[]
    authority_level: number
  }
  metadata?: JsonObject
}

export interface AgentFormData extends FormData {
  // FormData is already properly typed, but we can extend if needed
}

export interface AgentUploadOptions {
  params?: {
    organization_id?: string
    organizationId?: string
    validateOnly?: boolean
  }
}