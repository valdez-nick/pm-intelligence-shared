/**
 * Meeting Intelligence Workflow - Cross-Service Implementation
 * Orchestrates meeting analysis across assistant-mcp and platform-core services
 */

import { WorkflowOrchestrator, ServiceRegistry, MCPBridge } from '../utils/service-bridge.js';
import { DistributedStateManager, WorkflowStateManager } from '../utils/state-sync.js';
import { ErrorHandler, GracefulDegradationManager } from '../utils/error-handling.js';
import { EventBus } from '../utils/communication.js';
import { Workflow, WorkflowStep, MeetingAnalysis } from '../types/common.js';

export interface MeetingIntelligenceInput {
  transcript: string;
  meetingTitle?: string;
  participants: string[];
  projectKey: string;
  assignee?: string;
  meeting_type?: 'sprint_planning' | 'retrospective' | 'standup' | 'planning' | 'review';
  duration_minutes?: number;
  date?: string;
}

export interface MeetingIntelligenceOutput {
  workflowId: string;
  analysisResults: MeetingAnalysis;
  jiraTickets: Array<{
    key: string;
    summary: string;
    description: string;
    url: string;
  }>;
  confluencePages: Array<{
    id: string;
    title: string;
    url: string;
  }>;
  executionTime: number;
  success: boolean;
  errors?: string[];
}

/**
 * Meeting Intelligence Workflow Implementation
 * Demonstrates advanced cross-service orchestration with error handling
 */
export class MeetingIntelligenceWorkflow {
  private workflowOrchestrator: WorkflowOrchestrator;
  private stateManager: DistributedStateManager;
  private workflowStateManager: WorkflowStateManager;
  private errorHandler: ErrorHandler;
  private degradationManager: GracefulDegradationManager;
  private eventBus: EventBus;

  constructor(
    workflowOrchestrator: WorkflowOrchestrator,
    stateManager: DistributedStateManager,
    errorHandler: ErrorHandler,
    degradationManager: GracefulDegradationManager,
    eventBus: EventBus
  ) {
    this.workflowOrchestrator = workflowOrchestrator;
    this.stateManager = stateManager;
    this.workflowStateManager = new WorkflowStateManager(stateManager);
    this.errorHandler = errorHandler;
    this.degradationManager = degradationManager;
    this.eventBus = eventBus;
  }

  /**
   * Execute the complete meeting intelligence workflow
   */
  async execute(input: MeetingIntelligenceInput): Promise<MeetingIntelligenceOutput> {
    const workflowId = `meeting_intel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    console.log(`🎯 Starting Meeting Intelligence Workflow: ${workflowId}`);
    
    // Create workflow definition
    const workflow: Workflow = {
      id: workflowId,
      name: 'Meeting Intelligence',
      type: 'meeting_intelligence',
      status: 'running',
      progress: 0,
      steps: this.createWorkflowSteps(input),
      startTime: new Date().toISOString(),
      input,
      metadata: {
        projectKey: input.projectKey,
        participantCount: input.participants.length,
        meetingType: input.meeting_type || 'general'
      }
    };

    // Initialize workflow state
    await this.workflowStateManager.updateWorkflow(workflow);

    try {
      // Execute workflow with error handling and state management
      const result = await this.workflowOrchestrator.executeWorkflow(workflow);
      
      const output: MeetingIntelligenceOutput = {
        workflowId,
        analysisResults: result.analysisResults || {} as MeetingAnalysis,
        jiraTickets: result.jiraTickets || [],
        confluencePages: result.confluencePages || [],
        executionTime: Date.now() - startTime,
        success: true
      };

      console.log(`✅ Meeting Intelligence Workflow completed: ${workflowId}`);
      return output;

    } catch (error) {
      console.error(`❌ Meeting Intelligence Workflow failed: ${workflowId}`, error);
      
      // Get partial results from workflow state
      const currentWorkflow = await this.workflowStateManager.getWorkflow(workflowId);
      const partialResults = this.extractPartialResults(currentWorkflow);

      return {
        workflowId,
        analysisResults: partialResults.analysisResults,
        jiraTickets: partialResults.jiraTickets,
        confluencePages: partialResults.confluencePages,
        executionTime: Date.now() - startTime,
        success: false,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Create workflow steps for meeting intelligence
   */
  private createWorkflowSteps(input: MeetingIntelligenceInput): WorkflowStep[] {
    return [
      {
        id: 'step_1_analyze_meeting',
        name: 'analyze_meeting',
        service: 'assistant-mcp',
        status: 'pending',
        input: {
          text: input.transcript,
          meeting_type: input.meeting_type || 'general',
          participants: input.participants,
          title: input.meetingTitle
        },
        dependencies: [],
        retryCount: 0,
        maxRetries: 3
      },
      {
        id: 'step_2_extract_action_items',
        name: 'extract_action_items',
        service: 'assistant-mcp',
        status: 'pending',
        input: {
          analysis_id: '${step_1_analyze_meeting.output.analysis_id}',
          project_context: input.projectKey
        },
        dependencies: ['step_1_analyze_meeting'],
        retryCount: 0,
        maxRetries: 3
      },
      {
        id: 'step_3_create_jira_tickets',
        name: 'create_jira_tickets',
        service: 'platform-core',
        status: 'pending',
        input: {
          action_items: '${step_2_extract_action_items.output.action_items}',
          project_key: input.projectKey,
          assignee: input.assignee,
          meeting_reference: {
            title: input.meetingTitle,
            date: input.date || new Date().toISOString().split('T')[0],
            participants: input.participants
          }
        },
        dependencies: ['step_2_extract_action_items'],
        retryCount: 0,
        maxRetries: 2
      },
      {
        id: 'step_4_create_meeting_summary',
        name: 'generate_meeting_summary',
        service: 'assistant-mcp',
        status: 'pending',
        input: {
          analysis_results: '${step_1_analyze_meeting.output}',
          action_items: '${step_2_extract_action_items.output.action_items}',
          jira_tickets: '${step_3_create_jira_tickets.output.tickets}',
          format: 'confluence'
        },
        dependencies: ['step_1_analyze_meeting', 'step_2_extract_action_items', 'step_3_create_jira_tickets'],
        retryCount: 0,
        maxRetries: 2
      },
      {
        id: 'step_5_create_confluence_page',
        name: 'create_confluence_page',
        service: 'platform-core',
        status: 'pending',
        input: {
          title: `Meeting Notes: ${input.meetingTitle || 'Team Meeting'} - ${input.date || new Date().toISOString().split('T')[0]}`,
          content: '${step_4_create_meeting_summary.output.summary}',
          space_key: 'MEET',
          parent_page_id: null,
          labels: ['meeting-notes', 'auto-generated', input.projectKey.toLowerCase()]
        },
        dependencies: ['step_4_create_meeting_summary'],
        retryCount: 0,
        maxRetries: 2
      },
      {
        id: 'step_6_send_notifications',
        name: 'send_notifications',
        service: 'platform-core',
        status: 'pending',
        input: {
          recipients: input.participants,
          template: 'meeting_summary',
          data: {
            meeting_title: input.meetingTitle,
            jira_tickets: '${step_3_create_jira_tickets.output.tickets}',
            confluence_page: '${step_5_create_confluence_page.output.page}',
            action_items_count: '${step_2_extract_action_items.output.action_items.length}'
          }
        },
        dependencies: ['step_3_create_jira_tickets', 'step_5_create_confluence_page'],
        retryCount: 0,
        maxRetries: 1,
        optional: true // Don't fail workflow if notifications fail
      }
    ];
  }

  /**
   * Extract partial results from failed workflow
   */
  private extractPartialResults(workflow: Workflow | null): Partial<MeetingIntelligenceOutput> {
    if (!workflow) {
      return {
        analysisResults: {} as MeetingAnalysis,
        jiraTickets: [],
        confluencePages: []
      };
    }

    const completedSteps = workflow.steps.filter(step => step.status === 'completed');
    
    // Extract analysis results
    const analysisStep = completedSteps.find(step => step.name === 'analyze_meeting');
    const analysisResults = analysisStep?.output as MeetingAnalysis || {} as MeetingAnalysis;

    // Extract Jira tickets
    const jiraStep = completedSteps.find(step => step.name === 'create_jira_tickets');
    const jiraTickets = jiraStep?.output?.tickets || [];

    // Extract Confluence pages
    const confluenceStep = completedSteps.find(step => step.name === 'create_confluence_page');
    const confluencePages = confluenceStep?.output?.page ? [confluenceStep.output.page] : [];

    return {
      analysisResults,
      jiraTickets,
      confluencePages
    };
  }

  /**
   * Monitor workflow progress in real-time
   */
  async *monitorProgress(workflowId: string): AsyncGenerator<{ 
    progress: number; 
    currentStep: string; 
    status: string;
    stepResults?: any;
  }> {
    let lastProgress = 0;
    
    while (true) {
      const workflow = await this.workflowStateManager.getWorkflow(workflowId);
      
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      const progress = workflow.progress;
      const currentStep = workflow.steps.find(step => step.status === 'running')?.name || 
                         workflow.steps.find(step => step.status === 'pending')?.name || 
                         'completed';

      if (progress !== lastProgress || workflow.status === 'completed' || workflow.status === 'failed') {
        const completedStep = workflow.steps.find(step => 
          step.status === 'completed' && 
          step.output && 
          Object.keys(step.output).length > 0
        );

        yield {
          progress,
          currentStep,
          status: workflow.status,
          stepResults: completedStep?.output
        };

        lastProgress = progress;

        if (workflow.status === 'completed' || workflow.status === 'failed') {
          break;
        }
      }

      // Check every 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  /**
   * Cancel a running workflow
   */
  async cancelWorkflow(workflowId: string): Promise<boolean> {
    const workflow = await this.workflowStateManager.getWorkflow(workflowId);
    
    if (!workflow || workflow.status === 'completed' || workflow.status === 'failed') {
      return false;
    }

    // Use workflow orchestrator to cancel
    const cancelled = this.workflowOrchestrator.cancelWorkflow(workflowId);
    
    if (cancelled) {
      console.log(`🛑 Meeting Intelligence Workflow cancelled: ${workflowId}`);
    }

    return cancelled;
  }

  /**
   * Get workflow execution summary
   */
  async getWorkflowSummary(workflowId: string): Promise<{
    workflow: Workflow;
    executionMetrics: {
      totalSteps: number;
      completedSteps: number;
      failedSteps: number;
      averageStepDuration: number;
      totalDuration: number;
    };
    results: Partial<MeetingIntelligenceOutput>;
  }> {
    const workflow = await this.workflowStateManager.getWorkflow(workflowId);
    
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const completedSteps = workflow.steps.filter(step => step.status === 'completed');
    const failedSteps = workflow.steps.filter(step => step.status === 'failed');
    
    // Calculate durations
    const stepDurations = workflow.steps
      .filter(step => step.startTime && step.endTime)
      .map(step => 
        new Date(step.endTime!).getTime() - new Date(step.startTime!).getTime()
      );
    
    const averageStepDuration = stepDurations.length > 0 
      ? stepDurations.reduce((a, b) => a + b, 0) / stepDurations.length 
      : 0;

    const totalDuration = workflow.endTime 
      ? new Date(workflow.endTime).getTime() - new Date(workflow.startTime).getTime()
      : Date.now() - new Date(workflow.startTime).getTime();

    return {
      workflow,
      executionMetrics: {
        totalSteps: workflow.steps.length,
        completedSteps: completedSteps.length,
        failedSteps: failedSteps.length,
        averageStepDuration,
        totalDuration
      },
      results: this.extractPartialResults(workflow)
    };
  }
}

/**
 * Factory function to create Meeting Intelligence Workflow
 */
export function createMeetingIntelligenceWorkflow(
  serviceRegistry: ServiceRegistry,
  mcpBridge: MCPBridge,
  stateManager: DistributedStateManager,
  errorHandler: ErrorHandler,
  degradationManager: GracefulDegradationManager,
  eventBus: EventBus
): MeetingIntelligenceWorkflow {
  const workflowOrchestrator = new WorkflowOrchestrator(serviceRegistry, mcpBridge, eventBus);
  
  return new MeetingIntelligenceWorkflow(
    workflowOrchestrator,
    stateManager,
    errorHandler,
    degradationManager,
    eventBus
  );
}

/**
 * Example usage and integration patterns
 */
export class MeetingIntelligenceService {
  private workflow: MeetingIntelligenceWorkflow;

  constructor(workflow: MeetingIntelligenceWorkflow) {
    this.workflow = workflow;
  }

  /**
   * Process meeting with real-time updates
   */
  async processMeetingWithUpdates(
    input: MeetingIntelligenceInput,
    onProgress?: (update: { progress: number; currentStep: string; status: string }) => void
  ): Promise<MeetingIntelligenceOutput> {
    // Start workflow execution
    const executionPromise = this.workflow.execute(input);
    
    // Monitor progress if callback provided
    if (onProgress) {
      const monitorPromise = (async () => {
        try {
          // Wait a bit for workflow to start
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const workflowId = (await executionPromise).workflowId;
          
          for await (const update of this.workflow.monitorProgress(workflowId)) {
            onProgress(update);
          }
        } catch (error) {
          console.warn('Progress monitoring failed:', error);
        }
      })();
      
      // Don't wait for monitoring to complete
      monitorPromise.catch(() => {});
    }

    return executionPromise;
  }

  /**
   * Process multiple meetings in parallel
   */
  async processMeetingsBatch(
    meetings: MeetingIntelligenceInput[],
    maxConcurrent: number = 3
  ): Promise<MeetingIntelligenceOutput[]> {
    const results: MeetingIntelligenceOutput[] = [];
    const batches = this.chunkArray(meetings, maxConcurrent);

    for (const batch of batches) {
      const batchPromises = batch.map(meeting => this.workflow.execute(meeting));
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`Meeting ${index} in batch failed:`, result.reason);
          // Create error result
          results.push({
            workflowId: `failed_${Date.now()}_${index}`,
            analysisResults: {} as MeetingAnalysis,
            jiraTickets: [],
            confluencePages: [],
            executionTime: 0,
            success: false,
            errors: [result.reason instanceof Error ? result.reason.message : String(result.reason)]
          });
        }
      });
    }

    return results;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}