/**
 * Service Bridge - Core Integration Layer
 * Implements MCP-to-HTTP bridge and service orchestration
 */

import { ServiceClient, CircuitBreaker, EventBus } from './communication.js';
import { ApiResponse, Workflow, WorkflowStep } from '../types/common.js';

export interface ServiceConfig {
  name: string;
  type: 'mcp' | 'http' | 'websocket';
  url: string;
  healthEndpoint: string;
  timeout: number;
  retryAttempts: number;
}

export interface ServiceStatus {
  name: string;
  healthy: boolean;
  lastCheck: string;
  responseTime: number;
  version?: string;
}

/**
 * Central service registry and health monitoring
 */
export class ServiceRegistry {
  private services: Map<string, ServiceConfig> = new Map();
  private clients: Map<string, ServiceClient> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private healthStatus: Map<string, ServiceStatus> = new Map();
  private eventBus: EventBus;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Register a service with the registry
   */
  registerService(config: ServiceConfig): void {
    this.services.set(config.name, config);
    
    // Create service client
    const client = new ServiceClient(config.url, { timeout: config.timeout });
    this.clients.set(config.name, client);
    
    // Create circuit breaker
    const circuitBreaker = new CircuitBreaker(5, 60000); // 5 failures, 1 min recovery
    this.circuitBreakers.set(config.name, circuitBreaker);
    
    // Initialize health status
    this.healthStatus.set(config.name, {
      name: config.name,
      healthy: false,
      lastCheck: new Date().toISOString(),
      responseTime: 0
    });

    console.log(`📋 Service registered: ${config.name} (${config.type}) at ${config.url}`);
  }

  /**
   * Get service client with circuit breaker protection
   */
  async getService(serviceName: string): Promise<ServiceClient> {
    const client = this.clients.get(serviceName);
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    
    if (!client || !circuitBreaker) {
      throw new Error(`Service not found: ${serviceName}`);
    }

    // Check if service is healthy
    const status = this.healthStatus.get(serviceName);
    if (!status?.healthy && circuitBreaker.getState() === 'open') {
      throw new Error(`Service ${serviceName} is unavailable (circuit breaker open)`);
    }

    return client;
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async executeWithProtection<T>(
    serviceName: string,
    operation: (client: ServiceClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getService(serviceName);
    const circuitBreaker = this.circuitBreakers.get(serviceName)!;

    return circuitBreaker.execute(async () => {
      const startTime = Date.now();
      try {
        const result = await operation(client);
        
        // Update health status on success
        this.updateHealthStatus(serviceName, true, Date.now() - startTime);
        
        return result;
      } catch (error) {
        // Update health status on failure
        this.updateHealthStatus(serviceName, false, Date.now() - startTime);
        throw error;
      }
    });
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring(intervalMs: number = 30000): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, intervalMs);

    console.log(`💓 Health monitoring started (${intervalMs}ms interval)`);
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Perform health checks on all services
   */
  private async performHealthChecks(): Promise<void> {
    const healthPromises = Array.from(this.services.keys()).map(async (serviceName) => {
      try {
        const client = this.clients.get(serviceName)!;
        const config = this.services.get(serviceName)!;
        
        const startTime = Date.now();
        const response = await client.get(config.healthEndpoint);
        const responseTime = Date.now() - startTime;
        
        const isHealthy = response.success;
        this.updateHealthStatus(serviceName, isHealthy, responseTime, response.data?.version);
        
        // Emit health events
        this.eventBus.publish({
          type: isHealthy ? 'service.healthy' : 'service.unhealthy',
          data: { serviceName, responseTime, status: this.healthStatus.get(serviceName) }
        });
        
      } catch (error) {
        this.updateHealthStatus(serviceName, false, 0);
        this.eventBus.publish({
          type: 'service.error',
          data: { serviceName, error: error instanceof Error ? error.message : 'Unknown error' }
        });
      }
    });

    await Promise.allSettled(healthPromises);
  }

  /**
   * Update health status for a service
   */
  private updateHealthStatus(
    serviceName: string, 
    healthy: boolean, 
    responseTime: number, 
    version?: string
  ): void {
    this.healthStatus.set(serviceName, {
      name: serviceName,
      healthy,
      lastCheck: new Date().toISOString(),
      responseTime,
      version
    });
  }

  /**
   * Get overall service health summary
   */
  getHealthSummary(): { total: number; healthy: number; unhealthy: number; services: ServiceStatus[] } {
    const services = Array.from(this.healthStatus.values());
    const healthy = services.filter(s => s.healthy);
    
    return {
      total: services.length,
      healthy: healthy.length,
      unhealthy: services.length - healthy.length,
      services
    };
  }
}

/**
 * MCP to HTTP Bridge for assistant-mcp integration
 */
export class MCPBridge {
  private serviceRegistry: ServiceRegistry;
  private eventBus: EventBus;

  constructor(serviceRegistry: ServiceRegistry, eventBus: EventBus) {
    this.serviceRegistry = serviceRegistry;
    this.eventBus = eventBus;
  }

  /**
   * Route MCP tool call to appropriate HTTP service
   */
  async routeToolCall(toolName: string, parameters: any): Promise<ApiResponse> {
    // Determine target service based on tool name
    const targetService = this.getTargetService(toolName);
    
    if (!targetService) {
      return {
        success: false,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `No service found for tool: ${toolName}`,
          details: { toolName, availableServices: Array.from(this.serviceRegistry['services'].keys()) }
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
          version: '1.0'
        }
      };
    }

    // Execute tool call with circuit breaker protection
    try {
      return await this.serviceRegistry.executeWithProtection(
        targetService.service,
        async (client) => {
          const response = await client.post(targetService.endpoint, parameters);
          
          // Emit event for tool execution
          this.eventBus.publish({
            type: 'tool.executed',
            data: { toolName, service: targetService.service, success: response.success }
          });
          
          return response;
        }
      );
    } catch (error) {
      // Emit error event
      this.eventBus.publish({
        type: 'tool.failed',
        data: { toolName, service: targetService.service, error: error instanceof Error ? error.message : 'Unknown error' }
      });

      return {
        success: false,
        error: {
          code: 'TOOL_EXECUTION_FAILED',
          message: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: { toolName, service: targetService.service }
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
          version: '1.0'
        }
      };
    }
  }

  /**
   * Determine target service and endpoint for tool
   */
  private getTargetService(toolName: string): { service: string; endpoint: string } | null {
    // Tool routing configuration
    const toolRoutes: Record<string, { service: string; endpoint: string }> = {
      // Assistant-MCP tools
      'analyze_text': { service: 'assistant-mcp', endpoint: '/analyze/text' },
      'analyze_entities': { service: 'assistant-mcp', endpoint: '/analyze/entities' },
      'analyze_meeting': { service: 'assistant-mcp', endpoint: '/meeting/analyze' },
      'extract_action_items': { service: 'assistant-mcp', endpoint: '/meeting/action_items' },
      'score_wsjf_item': { service: 'assistant-mcp', endpoint: '/wsjf/score_item' },
      'bulk_prioritize_wsjf': { service: 'assistant-mcp', endpoint: '/wsjf/bulk_prioritize' },
      'generate_prd': { service: 'assistant-mcp', endpoint: '/document/generate_prd' },
      'search_vault': { service: 'assistant-mcp', endpoint: '/vault/search' },
      'discover_okr_context': { service: 'assistant-mcp', endpoint: '/vault/okr_context' },
      
      // Platform-Core tools
      'execute_workflow': { service: 'platform-core', endpoint: '/api/v1/workflows/execute' },
      'get_workflow_status': { service: 'platform-core', endpoint: '/api/v1/workflows/{id}/status' },
      'create_jira_ticket': { service: 'platform-core', endpoint: '/api/v1/jira/tickets' },
      'update_confluence_page': { service: 'platform-core', endpoint: '/api/v1/confluence/pages' },
      'send_notification': { service: 'platform-core', endpoint: '/api/v1/notifications' }
    };

    return toolRoutes[toolName] || null;
  }
}

/**
 * Workflow orchestration with cross-service coordination
 */
export class WorkflowOrchestrator {
  private serviceRegistry: ServiceRegistry;
  private mcpBridge: MCPBridge;
  private eventBus: EventBus;
  private activeWorkflows: Map<string, Workflow> = new Map();

  constructor(serviceRegistry: ServiceRegistry, mcpBridge: MCPBridge, eventBus: EventBus) {
    this.serviceRegistry = serviceRegistry;
    this.mcpBridge = mcpBridge;
    this.eventBus = eventBus;

    // Subscribe to workflow events
    this.eventBus.subscribe('workflow.step.completed', this.handleStepCompleted.bind(this));
    this.eventBus.subscribe('workflow.step.failed', this.handleStepFailed.bind(this));
  }

  /**
   * Execute a workflow across multiple services
   */
  async executeWorkflow(workflow: Workflow): Promise<void> {
    this.activeWorkflows.set(workflow.id, workflow);
    
    console.log(`🚀 Starting workflow: ${workflow.name} (${workflow.id})`);
    
    // Emit workflow started event
    this.eventBus.publish({
      type: 'workflow.started',
      data: { workflowId: workflow.id, workflow }
    });

    try {
      // Execute steps sequentially (can be enhanced for parallel execution)
      for (const step of workflow.steps) {
        await this.executeStep(workflow.id, step);
        
        // Check if workflow should continue
        const currentWorkflow = this.activeWorkflows.get(workflow.id);
        if (!currentWorkflow || currentWorkflow.status === 'cancelled') {
          console.log(`⏹️ Workflow cancelled: ${workflow.id}`);
          return;
        }
      }

      // Mark workflow as completed
      workflow.status = 'completed';
      workflow.progress = 100;
      workflow.endTime = new Date().toISOString();
      
      this.eventBus.publish({
        type: 'workflow.completed',
        data: { workflowId: workflow.id, workflow }
      });

      console.log(`✅ Workflow completed: ${workflow.name} (${workflow.id})`);
      
    } catch (error) {
      // Mark workflow as failed
      workflow.status = 'failed';
      workflow.error = error instanceof Error ? error.message : 'Unknown error';
      
      this.eventBus.publish({
        type: 'workflow.failed',
        data: { workflowId: workflow.id, workflow, error: workflow.error }
      });

      console.error(`❌ Workflow failed: ${workflow.name} (${workflow.id}) - ${workflow.error}`);
    } finally {
      this.activeWorkflows.delete(workflow.id);
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(workflowId: string, step: WorkflowStep): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    console.log(`📋 Executing step: ${step.name} (${step.service})`);
    
    step.status = 'running';
    step.startTime = new Date().toISOString();

    try {
      let result: any;

      if (step.service === 'assistant-mcp') {
        // Use MCP bridge for assistant-mcp calls
        result = await this.mcpBridge.routeToolCall(step.name, step.input);
      } else if (step.service === 'platform-core') {
        // Direct HTTP call to platform-core
        result = await this.serviceRegistry.executeWithProtection(
          'platform-core',
          async (client) => client.post(`/api/v1/${step.name}`, step.input)
        );
      } else {
        throw new Error(`Unknown service: ${step.service}`);
      }

      // Update step with results
      step.status = 'completed';
      step.endTime = new Date().toISOString();
      step.output = result.data;

      // Update workflow progress
      const completedSteps = workflow.steps.filter(s => s.status === 'completed').length;
      workflow.progress = Math.round((completedSteps / workflow.steps.length) * 100);

      this.eventBus.publish({
        type: 'workflow.step.completed',
        data: { workflowId, stepId: step.id, step, result }
      });

    } catch (error) {
      step.status = 'failed';
      step.endTime = new Date().toISOString();
      step.error = error instanceof Error ? error.message : 'Unknown error';

      this.eventBus.publish({
        type: 'workflow.step.failed',
        data: { workflowId, stepId: step.id, step, error: step.error }
      });

      throw error;
    }
  }

  /**
   * Handle step completion events
   */
  private handleStepCompleted(event: any): void {
    const { workflowId, stepId, result } = event.data;
    console.log(`✅ Step completed: ${stepId} in workflow ${workflowId}`);
  }

  /**
   * Handle step failure events
   */
  private handleStepFailed(event: any): void {
    const { workflowId, stepId, error } = event.data;
    console.error(`❌ Step failed: ${stepId} in workflow ${workflowId} - ${error}`);
  }

  /**
   * Get active workflows
   */
  getActiveWorkflows(): Workflow[] {
    return Array.from(this.activeWorkflows.values());
  }

  /**
   * Cancel a workflow
   */
  cancelWorkflow(workflowId: string): boolean {
    const workflow = this.activeWorkflows.get(workflowId);
    if (workflow) {
      workflow.status = 'cancelled';
      this.eventBus.publish({
        type: 'workflow.cancelled',
        data: { workflowId, workflow }
      });
      return true;
    }
    return false;
  }
}

/**
 * Initialize the complete service integration layer
 */
export function createServiceBridge(): {
  serviceRegistry: ServiceRegistry;
  mcpBridge: MCPBridge;
  workflowOrchestrator: WorkflowOrchestrator;
  eventBus: EventBus;
} {
  const eventBus = new EventBus();
  const serviceRegistry = new ServiceRegistry(eventBus);
  const mcpBridge = new MCPBridge(serviceRegistry, eventBus);
  const workflowOrchestrator = new WorkflowOrchestrator(serviceRegistry, mcpBridge, eventBus);

  // Register default services
  serviceRegistry.registerService({
    name: 'assistant-mcp',
    type: 'http',
    url: 'http://localhost:3001',
    healthEndpoint: '/health',
    timeout: 30000,
    retryAttempts: 3
  });

  serviceRegistry.registerService({
    name: 'platform-core',
    type: 'http', 
    url: 'http://localhost:8000',
    healthEndpoint: '/health',
    timeout: 30000,
    retryAttempts: 3
  });

  // Start health monitoring
  serviceRegistry.startHealthMonitoring();

  console.log('🔗 Service bridge initialized with assistant-mcp and platform-core integration');

  return {
    serviceRegistry,
    mcpBridge,
    workflowOrchestrator,
    eventBus
  };
}