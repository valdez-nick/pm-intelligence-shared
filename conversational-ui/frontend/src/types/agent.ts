export interface Agent {
  id: string;
  name: string;
  role: string;
  organization_id: string;
  status: string;
  authority_level: number;
  current_workload: number;
  capabilities: string[];
  persona?: {
    description: string;
    expertise: string[];
    decision_style: string;
    communication_style: string;
    priorities: string[];
    constraints: string[];
  };
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
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
  custom_config?: Record<string, any>;
}

export interface AgentResponse {
  agent_id: string;
  status: string;
  data?: Record<string, any>;
  error?: string;
}