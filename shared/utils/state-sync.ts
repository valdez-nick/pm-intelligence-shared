/**
 * Unified State Synchronization System
 * Manages shared state across Node.js and Python services
 */

import { EventBus } from './communication.js';
import { Workflow, WorkflowStep, MeetingAnalysis, WSJFScore } from '../types/common.js';

export interface StateChangeEvent {
  type: 'create' | 'update' | 'delete';
  entity: string;
  entityId: string;
  data: any;
  timestamp: string;
  source: string;
  correlationId?: string;
}

export interface SyncConflict {
  entityId: string;
  localVersion: any;
  remoteVersion: any;
  timestamp: string;
  conflictType: 'concurrent_update' | 'version_mismatch' | 'data_corruption';
}

/**
 * Distributed state manager with conflict resolution
 */
export class DistributedStateManager {
  private eventBus: EventBus;
  private localState: Map<string, any> = new Map();
  private versionVectors: Map<string, Record<string, number>> = new Map();
  private pendingSyncs: Map<string, StateChangeEvent[]> = new Map();
  private conflictResolver: ConflictResolver;
  private serviceId: string;

  constructor(eventBus: EventBus, serviceId: string) {
    this.eventBus = eventBus;
    this.serviceId = serviceId;
    this.conflictResolver = new ConflictResolver();

    // Subscribe to state change events
    this.eventBus.subscribe('state.change', this.handleRemoteStateChange.bind(this));
    this.eventBus.subscribe('state.sync.request', this.handleSyncRequest.bind(this));
    this.eventBus.subscribe('state.sync.response', this.handleSyncResponse.bind(this));
  }

  /**
   * Get entity from local state with automatic sync
   */
  async get<T>(entityType: string, entityId: string): Promise<T | null> {
    const key = `${entityType}:${entityId}`;
    const entity = this.localState.get(key);
    
    if (!entity) {
      // Request entity from other services
      await this.requestEntitySync(entityType, entityId);
      return this.localState.get(key) || null;
    }
    
    return entity as T;
  }

  /**
   * Set entity in local state and propagate changes
   */
  async set<T>(entityType: string, entityId: string, data: T, correlationId?: string): Promise<void> {
    const key = `${entityType}:${entityId}`;
    const previousData = this.localState.get(key);
    
    // Update local state
    this.localState.set(key, data);
    
    // Update version vector
    this.updateVersionVector(key);
    
    // Create state change event
    const changeEvent: StateChangeEvent = {
      type: previousData ? 'update' : 'create',
      entity: entityType,
      entityId,
      data,
      timestamp: new Date().toISOString(),
      source: this.serviceId,
      correlationId
    };
    
    // Propagate to other services
    this.eventBus.publish({
      type: 'state.change',
      data: changeEvent
    });
    
    console.log(`📊 State updated: ${entityType}:${entityId} from ${this.serviceId}`);
  }

  /**
   * Delete entity from local state and propagate
   */
  async delete(entityType: string, entityId: string, correlationId?: string): Promise<void> {
    const key = `${entityType}:${entityId}`;
    const data = this.localState.get(key);
    
    if (data) {
      this.localState.delete(key);
      this.versionVectors.delete(key);
      
      const changeEvent: StateChangeEvent = {
        type: 'delete',
        entity: entityType,
        entityId,
        data: null,
        timestamp: new Date().toISOString(),
        source: this.serviceId,
        correlationId
      };
      
      this.eventBus.publish({
        type: 'state.change',
        data: changeEvent
      });
      
      console.log(`🗑️ State deleted: ${entityType}:${entityId} from ${this.serviceId}`);
    }
  }

  /**
   * Handle remote state changes from other services
   */
  private async handleRemoteStateChange(event: any): Promise<void> {
    const changeEvent: StateChangeEvent = event.data;
    
    // Ignore our own changes
    if (changeEvent.source === this.serviceId) {
      return;
    }
    
    const key = `${changeEvent.entity}:${changeEvent.entityId}`;
    const localData = this.localState.get(key);
    const localVersion = this.versionVectors.get(key);
    
    // Check for conflicts
    if (localData && localVersion) {
      const conflict = this.detectConflict(key, changeEvent, localVersion);
      if (conflict) {
        await this.resolveConflict(conflict, changeEvent);
        return;
      }
    }
    
    // Apply remote change
    if (changeEvent.type === 'delete') {
      this.localState.delete(key);
      this.versionVectors.delete(key);
    } else {
      this.localState.set(key, changeEvent.data);
      this.updateVersionVector(key, changeEvent.source);
    }
    
    console.log(`🔄 Remote state applied: ${key} from ${changeEvent.source}`);
  }

  /**
   * Request entity synchronization from other services
   */
  private async requestEntitySync(entityType: string, entityId: string): Promise<void> {
    this.eventBus.publish({
      type: 'state.sync.request',
      data: {
        entityType,
        entityId,
        requestingService: this.serviceId,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Handle sync requests from other services
   */
  private async handleSyncRequest(event: any): Promise<void> {
    const { entityType, entityId, requestingService } = event.data;
    
    if (requestingService === this.serviceId) {
      return;
    }
    
    const key = `${entityType}:${entityId}`;
    const entity = this.localState.get(key);
    
    if (entity) {
      this.eventBus.publish({
        type: 'state.sync.response',
        data: {
          entityType,
          entityId,
          data: entity,
          version: this.versionVectors.get(key),
          respondingService: this.serviceId,
          targetService: requestingService,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Handle sync responses from other services
   */
  private async handleSyncResponse(event: any): Promise<void> {
    const { entityType, entityId, data, version, targetService } = event.data;
    
    if (targetService !== this.serviceId) {
      return;
    }
    
    const key = `${entityType}:${entityId}`;
    this.localState.set(key, data);
    
    if (version) {
      this.versionVectors.set(key, version);
    }
    
    console.log(`📥 Sync response received: ${key}`);
  }

  /**
   * Update version vector for an entity
   */
  private updateVersionVector(key: string, source?: string): void {
    const vector = this.versionVectors.get(key) || {};
    const updateSource = source || this.serviceId;
    vector[updateSource] = (vector[updateSource] || 0) + 1;
    this.versionVectors.set(key, vector);
  }

  /**
   * Detect conflicts between local and remote changes
   */
  private detectConflict(
    key: string, 
    remoteChange: StateChangeEvent, 
    localVersion: Record<string, number>
  ): SyncConflict | null {
    // Simple conflict detection based on concurrent updates
    const remoteTimestamp = new Date(remoteChange.timestamp);
    const localTimestamp = new Date(); // Approximate
    
    const timeDiff = Math.abs(remoteTimestamp.getTime() - localTimestamp.getTime());
    
    // If changes happened within 5 seconds, consider it a conflict
    if (timeDiff < 5000) {
      return {
        entityId: remoteChange.entityId,
        localVersion: this.localState.get(key),
        remoteVersion: remoteChange.data,
        timestamp: new Date().toISOString(),
        conflictType: 'concurrent_update'
      };
    }
    
    return null;
  }

  /**
   * Resolve conflicts using configured strategy
   */
  private async resolveConflict(conflict: SyncConflict, remoteChange: StateChangeEvent): Promise<void> {
    const resolution = await this.conflictResolver.resolve(conflict, remoteChange);
    
    const key = `${remoteChange.entity}:${remoteChange.entityId}`;
    this.localState.set(key, resolution.resolvedData);
    this.updateVersionVector(key);
    
    // Emit conflict resolution event
    this.eventBus.publish({
      type: 'state.conflict.resolved',
      data: {
        conflict,
        resolution,
        resolvedBy: this.serviceId
      }
    });
    
    console.log(`⚖️ Conflict resolved for ${key}: ${resolution.strategy}`);
  }

  /**
   * Get sync statistics
   */
  getSyncStats(): {
    entitiesCount: number;
    pendingSyncs: number;
    conflictsResolved: number;
    lastSyncTime: string;
  } {
    return {
      entitiesCount: this.localState.size,
      pendingSyncs: Array.from(this.pendingSyncs.values()).reduce((acc, arr) => acc + arr.length, 0),
      conflictsResolved: this.conflictResolver.getConflictCount(),
      lastSyncTime: new Date().toISOString()
    };
  }
}

/**
 * Conflict resolution strategies
 */
export class ConflictResolver {
  private conflictCount = 0;

  async resolve(conflict: SyncConflict, remoteChange: StateChangeEvent): Promise<{
    resolvedData: any;
    strategy: string;
    metadata: any;
  }> {
    this.conflictCount++;
    
    switch (conflict.conflictType) {
      case 'concurrent_update':
        return this.resolveConcurrentUpdate(conflict, remoteChange);
      
      case 'version_mismatch':
        return this.resolveVersionMismatch(conflict, remoteChange);
      
      case 'data_corruption':
        return this.resolveDataCorruption(conflict, remoteChange);
      
      default:
        return this.defaultResolve(conflict, remoteChange);
    }
  }

  private async resolveConcurrentUpdate(conflict: SyncConflict, remoteChange: StateChangeEvent): Promise<any> {
    // Strategy: Merge changes intelligently based on entity type
    if (remoteChange.entity === 'workflow') {
      return this.mergeWorkflowChanges(conflict, remoteChange);
    } else if (remoteChange.entity === 'meeting_analysis') {
      return this.mergeMeetingAnalysisChanges(conflict, remoteChange);
    } else {
      // Default: Last writer wins with timestamp comparison
      return this.lastWriterWins(conflict, remoteChange);
    }
  }

  private async mergeWorkflowChanges(conflict: SyncConflict, remoteChange: StateChangeEvent): Promise<any> {
    const local = conflict.localVersion as Workflow;
    const remote = remoteChange.data as Workflow;
    
    // Merge workflow steps intelligently
    const mergedSteps = this.mergeWorkflowSteps(local.steps, remote.steps);
    
    const merged = {
      ...remote,
      steps: mergedSteps,
      progress: Math.max(local.progress, remote.progress),
      // Preserve local timestamps if more recent
      startTime: local.startTime < remote.startTime ? local.startTime : remote.startTime,
      endTime: local.endTime && remote.endTime ? 
        (local.endTime > remote.endTime ? local.endTime : remote.endTime) :
        local.endTime || remote.endTime
    };
    
    return {
      resolvedData: merged,
      strategy: 'workflow_intelligent_merge',
      metadata: { mergedStepsCount: mergedSteps.length }
    };
  }

  private mergeWorkflowSteps(localSteps: WorkflowStep[], remoteSteps: WorkflowStep[]): WorkflowStep[] {
    const stepMap = new Map<string, WorkflowStep>();
    
    // Add local steps
    localSteps.forEach(step => stepMap.set(step.id, step));
    
    // Merge with remote steps (prefer completed remote steps)
    remoteSteps.forEach(remoteStep => {
      const localStep = stepMap.get(remoteStep.id);
      
      if (!localStep) {
        stepMap.set(remoteStep.id, remoteStep);
      } else {
        // Prefer completed status
        if (remoteStep.status === 'completed' && localStep.status !== 'completed') {
          stepMap.set(remoteStep.id, remoteStep);
        } else if (localStep.status === 'completed' && remoteStep.status !== 'completed') {
          // Keep local
        } else {
          // Use more recent timestamp
          const localTime = new Date(localStep.startTime || 0);
          const remoteTime = new Date(remoteStep.startTime || 0);
          stepMap.set(remoteStep.id, remoteTime > localTime ? remoteStep : localStep);
        }
      }
    });
    
    return Array.from(stepMap.values()).sort((a, b) => 
      (localSteps.findIndex(s => s.id === a.id) || 0) - 
      (localSteps.findIndex(s => s.id === b.id) || 0)
    );
  }

  private async mergeMeetingAnalysisChanges(conflict: SyncConflict, remoteChange: StateChangeEvent): Promise<any> {
    const local = conflict.localVersion as MeetingAnalysis;
    const remote = remoteChange.data as MeetingAnalysis;
    
    const merged = {
      ...remote,
      // Merge action items (avoid duplicates)
      actionItems: this.mergeActionItems(local.actionItems, remote.actionItems),
      // Merge participants
      participants: this.mergeParticipants(local.participants, remote.participants),
      // Use longer summary
      summary: local.summary.length > remote.summary.length ? local.summary : remote.summary
    };
    
    return {
      resolvedData: merged,
      strategy: 'meeting_analysis_merge',
      metadata: { actionItemsCount: merged.actionItems.length }
    };
  }

  private mergeActionItems(local: any[], remote: any[]): any[] {
    const itemMap = new Map();
    
    [...local, ...remote].forEach(item => {
      const key = item.description.toLowerCase().trim();
      if (!itemMap.has(key) || item.status === 'completed') {
        itemMap.set(key, item);
      }
    });
    
    return Array.from(itemMap.values());
  }

  private mergeParticipants(local: any[], remote: any[]): any[] {
    const participantMap = new Map();
    
    [...local, ...remote].forEach(participant => {
      participantMap.set(participant.id, participant);
    });
    
    return Array.from(participantMap.values());
  }

  private async lastWriterWins(conflict: SyncConflict, remoteChange: StateChangeEvent): Promise<any> {
    // Simple strategy: use remote data
    return {
      resolvedData: remoteChange.data,
      strategy: 'last_writer_wins',
      metadata: { timestamp: remoteChange.timestamp }
    };
  }

  private async resolveVersionMismatch(conflict: SyncConflict, remoteChange: StateChangeEvent): Promise<any> {
    return this.lastWriterWins(conflict, remoteChange);
  }

  private async resolveDataCorruption(conflict: SyncConflict, remoteChange: StateChangeEvent): Promise<any> {
    // For data corruption, prefer the data that passes validation
    return {
      resolvedData: remoteChange.data,
      strategy: 'corruption_recovery',
      metadata: { corruptionDetected: true }
    };
  }

  private async defaultResolve(conflict: SyncConflict, remoteChange: StateChangeEvent): Promise<any> {
    return this.lastWriterWins(conflict, remoteChange);
  }

  getConflictCount(): number {
    return this.conflictCount;
  }
}

/**
 * Entity-specific state managers
 */
export class WorkflowStateManager {
  private stateManager: DistributedStateManager;

  constructor(stateManager: DistributedStateManager) {
    this.stateManager = stateManager;
  }

  async getWorkflow(workflowId: string): Promise<Workflow | null> {
    return this.stateManager.get<Workflow>('workflow', workflowId);
  }

  async updateWorkflow(workflow: Workflow, correlationId?: string): Promise<void> {
    await this.stateManager.set('workflow', workflow.id, workflow, correlationId);
  }

  async updateWorkflowStep(workflowId: string, stepId: string, updates: Partial<WorkflowStep>): Promise<void> {
    const workflow = await this.getWorkflow(workflowId);
    if (workflow) {
      const stepIndex = workflow.steps.findIndex(s => s.id === stepId);
      if (stepIndex >= 0) {
        workflow.steps[stepIndex] = { ...workflow.steps[stepIndex], ...updates };
        await this.updateWorkflow(workflow);
      }
    }
  }
}

export class MeetingStateManager {
  private stateManager: DistributedStateManager;

  constructor(stateManager: DistributedStateManager) {
    this.stateManager = stateManager;
  }

  async getMeetingAnalysis(meetingId: string): Promise<MeetingAnalysis | null> {
    return this.stateManager.get<MeetingAnalysis>('meeting_analysis', meetingId);
  }

  async updateMeetingAnalysis(analysis: MeetingAnalysis): Promise<void> {
    await this.stateManager.set('meeting_analysis', analysis.id, analysis);
  }
}

/**
 * Initialize distributed state management
 */
export function createStateSync(eventBus: EventBus, serviceId: string): {
  stateManager: DistributedStateManager;
  workflowManager: WorkflowStateManager;
  meetingManager: MeetingStateManager;
} {
  const stateManager = new DistributedStateManager(eventBus, serviceId);
  const workflowManager = new WorkflowStateManager(stateManager);
  const meetingManager = new MeetingStateManager(stateManager);

  console.log(`📊 Distributed state management initialized for service: ${serviceId}`);

  return {
    stateManager,
    workflowManager,
    meetingManager
  };
}