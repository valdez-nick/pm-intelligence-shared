/**
 * Error Propagation and Graceful Degradation
 * Handles cross-service error scenarios with fallback mechanisms
 */

import { EventBus } from './communication.js';
import { ApiResponse } from '../types/common.js';

export interface ErrorContext {
  service: string;
  operation: string;
  requestId: string;
  timestamp: string;
  correlationId?: string;
  retryCount?: number;
}

export interface ErrorConfig {
  maxRetries: number;
  retryDelayMs: number;
  circuitBreakerThreshold: number;
  timeoutMs: number;
  fallbackEnabled: boolean;
}

export interface ServiceError {
  code: string;
  message: string;
  context: ErrorContext;
  recoverable: boolean;
  fallbackAvailable: boolean;
}

/**
 * Error handler with retry logic and circuit breaker
 */
export class ErrorHandler {
  private eventBus: EventBus;
  private config: ErrorConfig;
  private errorStats: Map<string, { count: number; lastError: string }> = new Map();

  constructor(eventBus: EventBus, config: Partial<ErrorConfig> = {}) {
    this.eventBus = eventBus;
    this.config = {
      maxRetries: 3,
      retryDelayMs: 1000,
      circuitBreakerThreshold: 5,
      timeoutMs: 30000,
      fallbackEnabled: true,
      ...config
    };
  }

  /**
   * Execute operation with error handling and retries
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    fallback?: () => Promise<T>
  ): Promise<T> {
    let lastError: Error | null = null;
    const maxRetries = this.config.maxRetries;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Add timeout wrapper
        const result = await Promise.race([
          operation(),
          this.createTimeoutPromise(this.config.timeoutMs)
        ]);

        // Reset error count on success
        this.errorStats.delete(context.service);
        
        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Update error statistics
        this.updateErrorStats(context.service, lastError.message);
        
        // Emit error event
        await this.emitErrorEvent(context, lastError, attempt);

        // Check if we should retry
        if (attempt < maxRetries && this.shouldRetry(lastError)) {
          const delay = this.calculateRetryDelay(attempt);
          await this.delay(delay);
          continue;
        }

        // If all retries failed, try fallback
        if (this.config.fallbackEnabled && fallback) {
          try {
            console.warn(`🔄 Using fallback for ${context.service}.${context.operation}`);
            const fallbackResult = await fallback();
            
            await this.eventBus.publish({
              type: 'error.fallback.success',
              data: { context, fallbackUsed: true }
            });
            
            return fallbackResult;
          } catch (fallbackError) {
            await this.eventBus.publish({
              type: 'error.fallback.failed',
              data: { context, originalError: lastError.message, fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError) }
            });
          }
        }

        break;
      }
    }

    // Final error handling
    const serviceError: ServiceError = {
      code: this.getErrorCode(lastError!),
      message: lastError!.message,
      context: { ...context, retryCount: maxRetries },
      recoverable: this.isRecoverable(lastError!),
      fallbackAvailable: !!fallback
    };

    await this.emitFinalError(serviceError);
    throw new Error(`Operation failed after ${maxRetries + 1} attempts: ${lastError!.message}`);
  }

  /**
   * Check if error should trigger a retry
   */
  private shouldRetry(error: Error): boolean {
    const retryableErrors = [
      'NETWORK_ERROR',
      'TIMEOUT',
      'SERVICE_UNAVAILABLE',
      'RATE_LIMITED',
      'TEMPORARY_FAILURE'
    ];

    return retryableErrors.some(code => 
      error.message.includes(code) || 
      error.name.includes(code)
    );
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateRetryDelay(attempt: number): number {
    const baseDelay = this.config.retryDelayMs;
    const jitter = Math.random() * 0.1; // Add 10% jitter
    return Math.floor(baseDelay * Math.pow(2, attempt) * (1 + jitter));
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise<T>(timeoutMs: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update error statistics for circuit breaker
   */
  private updateErrorStats(service: string, errorMessage: string): void {
    const stats = this.errorStats.get(service) || { count: 0, lastError: '' };
    stats.count++;
    stats.lastError = errorMessage;
    this.errorStats.set(service, stats);
  }

  /**
   * Check if circuit breaker should open
   */
  isCircuitBreakerOpen(service: string): boolean {
    const stats = this.errorStats.get(service);
    return stats ? stats.count >= this.config.circuitBreakerThreshold : false;
  }

  /**
   * Get error code from error
   */
  private getErrorCode(error: Error): string {
    if (error.message.includes('timeout')) return 'TIMEOUT';
    if (error.message.includes('network')) return 'NETWORK_ERROR';
    if (error.message.includes('unauthorized')) return 'UNAUTHORIZED';
    if (error.message.includes('not found')) return 'NOT_FOUND';
    if (error.message.includes('rate limit')) return 'RATE_LIMITED';
    return 'UNKNOWN_ERROR';
  }

  /**
   * Check if error is recoverable
   */
  private isRecoverable(error: Error): boolean {
    const nonRecoverableErrors = ['UNAUTHORIZED', 'NOT_FOUND', 'INVALID_INPUT'];
    const errorCode = this.getErrorCode(error);
    return !nonRecoverableErrors.includes(errorCode);
  }

  /**
   * Emit error event during retry
   */
  private async emitErrorEvent(context: ErrorContext, error: Error, attempt: number): Promise<void> {
    await this.eventBus.publish({
      type: 'error.retry',
      data: {
        context,
        error: error.message,
        attempt,
        maxRetries: this.config.maxRetries
      }
    });
  }

  /**
   * Emit final error event
   */
  private async emitFinalError(serviceError: ServiceError): Promise<void> {
    await this.eventBus.publish({
      type: 'error.final',
      data: serviceError
    });
  }

  /**
   * Get error statistics
   */
  getErrorStats(): Record<string, { count: number; lastError: string }> {
    return Object.fromEntries(this.errorStats);
  }

  /**
   * Reset error statistics for a service
   */
  resetErrorStats(service: string): void {
    this.errorStats.delete(service);
  }
}

/**
 * Graceful degradation manager
 */
export class GracefulDegradationManager {
  private eventBus: EventBus;
  private fallbackStrategies: Map<string, () => Promise<any>> = new Map();
  private serviceCapabilities: Map<string, string[]> = new Map();

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.setupDefaultFallbacks();
  }

  /**
   * Register fallback strategy for a service operation
   */
  registerFallback(serviceOperation: string, fallback: () => Promise<any>): void {
    this.fallbackStrategies.set(serviceOperation, fallback);
    console.log(`📋 Fallback registered for ${serviceOperation}`);
  }

  /**
   * Register service capabilities
   */
  registerServiceCapabilities(service: string, capabilities: string[]): void {
    this.serviceCapabilities.set(service, capabilities);
  }

  /**
   * Get fallback for operation
   */
  getFallback(serviceOperation: string): (() => Promise<any>) | undefined {
    return this.fallbackStrategies.get(serviceOperation);
  }

  /**
   * Check if service can handle operation
   */
  canServiceHandle(service: string, operation: string): boolean {
    const capabilities = this.serviceCapabilities.get(service) || [];
    return capabilities.includes(operation);
  }

  /**
   * Find alternative service for operation
   */
  findAlternativeService(operation: string, excludeService?: string): string | null {
    for (const [service, capabilities] of this.serviceCapabilities.entries()) {
      if (service !== excludeService && capabilities.includes(operation)) {
        return service;
      }
    }
    return null;
  }

  /**
   * Setup default fallback strategies
   */
  private setupDefaultFallbacks(): void {
    // Fallback for text analysis when assistant-mcp is down
    this.registerFallback('assistant-mcp.analyze_text', async () => ({
      analysis_id: 'fallback_' + Date.now(),
      entities: { stakeholders: [], projects: [], keywords: [] },
      summary: 'Analysis service unavailable - using fallback',
      confidence: 0.1,
      fallback: true
    }));

    // Fallback for meeting analysis
    this.registerFallback('assistant-mcp.analyze_meeting', async () => ({
      meeting_id: 'fallback_' + Date.now(),
      actionItems: [],
      participants: [],
      summary: 'Meeting analysis service unavailable',
      fallback: true
    }));

    // Fallback for WSJF scoring
    this.registerFallback('assistant-mcp.score_wsjf_item', async () => ({
      item_id: 'fallback_' + Date.now(),
      wsjf_score: 1.0,
      businessValue: 1,
      customerValue: 1,
      strategicAlignment: 1,
      timeCriticality: 1,
      riskReduction: 1,
      effort: 8,
      fallback: true,
      note: 'WSJF service unavailable - using minimal score'
    }));

    // Register service capabilities
    this.registerServiceCapabilities('assistant-mcp', [
      'analyze_text',
      'analyze_entities', 
      'analyze_meeting',
      'score_wsjf_item',
      'generate_prd',
      'search_vault'
    ]);

    this.registerServiceCapabilities('platform-core', [
      'create_jira_ticket',
      'update_confluence_page',
      'send_notification',
      'execute_workflow'
    ]);
  }

  /**
   * Get degradation status
   */
  getDegradationStatus(): {
    totalFallbacks: number;
    activeServices: string[];
    degradedOperations: string[];
  } {
    return {
      totalFallbacks: this.fallbackStrategies.size,
      activeServices: Array.from(this.serviceCapabilities.keys()),
      degradedOperations: Array.from(this.fallbackStrategies.keys())
    };
  }
}

/**
 * Unified error response formatter
 */
export class ErrorResponseFormatter {
  static formatError(error: ServiceError): ApiResponse {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: {
          service: error.context.service,
          operation: error.context.operation,
          recoverable: error.recoverable,
          fallbackAvailable: error.fallbackAvailable,
          retryCount: error.context.retryCount || 0
        }
      },
      metadata: {
        timestamp: error.context.timestamp,
        requestId: error.context.requestId,
        version: '1.0'
      }
    };
  }

  static formatSuccess<T>(data: T, requestId: string): ApiResponse {
    return {
      success: true,
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        requestId,
        version: '1.0'
      }
    };
  }
}

/**
 * Initialize error handling system
 */
export function createErrorHandling(eventBus: EventBus, config?: Partial<ErrorConfig>): {
  errorHandler: ErrorHandler;
  degradationManager: GracefulDegradationManager;
  formatter: typeof ErrorResponseFormatter;
} {
  const errorHandler = new ErrorHandler(eventBus, config);
  const degradationManager = new GracefulDegradationManager(eventBus);

  console.log('🛡️ Error handling and graceful degradation initialized');

  return {
    errorHandler,
    degradationManager,
    formatter: ErrorResponseFormatter
  };
}