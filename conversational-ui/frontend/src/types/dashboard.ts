export interface WorkflowStatus {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  lastUpdate: string
  estimatedCompletion?: string
  completedAt?: string
  error?: string
  metadata?: Record<string, any>
}

export interface SystemMetrics {
  totalWorkflows: number
  activeWorkflows: number
  completedToday: number
  failedToday: number
  averageCompletionTime: number
  systemLoad: number
}

export interface DashboardData {
  workflows: WorkflowStatus[]
  systemMetrics: SystemMetrics
  timestamp: string
}

export interface WebSocketMessage {
  type: 'dashboard_update' | 'workflow_status' | 'system_metrics'
  data: DashboardData | WorkflowStatus | SystemMetrics
  timestamp: string
}