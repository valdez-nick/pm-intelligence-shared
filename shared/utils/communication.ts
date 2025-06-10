/**
 * Shared communication utilities for service integration
 */

import { ApiResponse } from '../types/common.js';

// HTTP Client for Service Communication
export class ServiceClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string, options: { timeout?: number } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = options.timeout || 30000;
  }

  async get<T>(path: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('GET', `${this.baseUrl}${path}`);
  }

  async post<T>(path: string, data?: any): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('POST', `${this.baseUrl}${path}`, data);
  }

  private async makeRequest<T>(method: string, url: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : undefined,
      });

      const result = await response.json();
      return result as ApiResponse<T>;
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'REQUEST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}

// Circuit Breaker for Service Resilience
export class CircuitBreaker {
  private failures = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(private failureThreshold = 5) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }
}

// Event Bus for Inter-Service Communication
export class EventBus {
  private listeners: Map<string, Array<(event: any) => void>> = new Map();

  subscribe(eventType: string, handler: (event: any) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    
    this.listeners.get(eventType)!.push(handler);

    return () => {
      const handlers = this.listeners.get(eventType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  publish(event: { type: string; data: any }): void {
    const handlers = this.listeners.get(event.type) || [];
    handlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error(`Error in event handler for ${event.type}:`, error);
      }
    });
  }
}