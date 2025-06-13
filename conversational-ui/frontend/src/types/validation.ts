// Validation-related types

import type { JsonObject } from './common'

export interface ValidationResult {
  valid: boolean
  errors?: ValidationError[]
  warnings?: ValidationWarning[]
  metadata?: JsonObject
}

export interface ValidationError {
  field?: string
  message: string
  code?: string
  severity: 'error'
}

export interface ValidationWarning {
  field?: string
  message: string
  code?: string
  severity: 'warning'
}

export interface AgentValidationResult extends ValidationResult {
  agentId?: string
  agentName?: string
  capabilities?: string[]
  requiredFields?: string[]
  total_agents?: number
  successful_agents?: number
  failed_agents?: string[]
}

export interface FormValidationResult extends ValidationResult {
  fields: Record<string, FieldValidation>
}

export interface FieldValidation {
  valid: boolean
  value?: unknown
  error?: string
  touched?: boolean
}