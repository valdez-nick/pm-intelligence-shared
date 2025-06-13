import type { JsonObject } from './common'

export interface AgentPersona {
  description: string;
  expertise: string[];
  decision_style: string;
  communication_style: string;
  priorities: string[];
  constraints: string[];
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  organization_id: string;
  status: 'active' | 'inactive' | 'pending' | 'error';
  authority_level: number;
  current_workload: number;
  capabilities: string[];
  persona?: AgentPersona;
  created_at: string;
  updated_at: string;
  metadata?: JsonObject;
}

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  category: string;
  complexity: string;
  required_tools: string[];
  required_data_sources: string[];
}

export interface CreateAgentRequest {
  name: string;
  role: string;
  organization_id: string;
  template_id?: string;
  custom_config?: JsonObject;
}

export interface AgentResponse {
  agent_id: string;
  status: string;
  data?: JsonObject;
  error?: string;
}