/**
 * Shared communication utilities for service integration
 */

import { ApiResponse, WebSocketMessage, DomainEvent } from '../types/common.js';

// HTTP Client for Service Communication
export class ServiceClient {
  private baseUrl: string;
  private timeout: number;
  private headers: Record<string, string>;

  constructor(baseUrl: string, options: { timeout?: number; headers?: Record<string, string> } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = options.timeout || 30000; // 30 second default
    this.headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'PM-Intelligence-Platform/1.0',
      ...options.headers
    };
  }

  async get<T>(path: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return this.makeRequest<T>('GET', url.toString());
  }

  async post<T>(path: string, data?: any): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('POST', `${this.baseUrl}${path}`, data);
  }

  async put<T>(path: string, data?: any): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('PUT', `${this.baseUrl}${path}`, data);
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>('DELETE', `${this.baseUrl}${path}`);
  }

  private async makeRequest<T>(method: string, url: string, data?: any): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: this.headers,
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Standardize response format
      if (result.success !== undefined) {
        return result as ApiResponse<T>;
      } else {
        // Legacy format - wrap in standard response
        return {
          success: true,
          data: result,
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: crypto.randomUUID(),
            version: '1.0'
          }
        };
      }
    } catch (error) {
      clearTimeout(timeoutId);
      
      return {
        success: false,
        error: {
          code: error instanceof Error && error.name === 'AbortError' ? 'TIMEOUT' : 'REQUEST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: { url, method }
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
          version: '1.0'
        }
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.get('/health');
      return response.success;
    } catch {
      return false;
    }
  }
}

// Circuit Breaker for Service Resilience
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private failureThreshold = 5,
    private recoveryTimeout = 60000, // 1 minute
    private monitoringPeriod = 300000 // 5 minutes
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
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
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): string {
    return this.state;
  }

  getFailureCount(): number {
    return this.failures;
  }
}

// Event Bus for Inter-Service Communication
export class EventBus {
  private listeners: Map<string, Array<(event: DomainEvent) => void | Promise<void>>> = new Map();
  private eventHistory: DomainEvent[] = [];
  private maxHistorySize = 1000;

  subscribe(eventType: string, handler: (event: DomainEvent) => void | Promise<void>): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    
    this.listeners.get(eventType)!.push(handler);

    // Return unsubscribe function
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

  async publish(event: DomainEvent): Promise<void> {
    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Notify listeners
    const handlers = this.listeners.get(event.type) || [];
    const promises = handlers.map(handler => {
      try {
        const result = handler(event);
        return result instanceof Promise ? result : Promise.resolve();
      } catch (error) {
        console.error(`Error in event handler for ${event.type}:`, error);
        return Promise.resolve();
      }
    });

    await Promise.allSettled(promises);
  }

  getEventHistory(eventType?: string, limit = 100): DomainEvent[] {
    const events = eventType 
      ? this.eventHistory.filter(e => e.type === eventType)
      : this.eventHistory;
    
    return events.slice(-limit);
  }

  clear(): void {
    this.listeners.clear();
    this.eventHistory = [];
  }
}

// WebSocket Manager for Real-time Communication
export class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageQueue: WebSocketMessage[] = [];
  private listeners: Map<string, Array<(message: WebSocketMessage) => void>> = new Map();

  constructor(private url: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          this.flushMessageQueue();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  subscribe(messageType: string, handler: (message: WebSocketMessage) => void): () => void {
    if (!this.listeners.has(messageType)) {
      this.listeners.set(messageType, []);
    }
    
    this.listeners.get(messageType)!.push(handler);

    return () => {
      const handlers = this.listeners.get(messageType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  private handleMessage(message: WebSocketMessage): void {
    const handlers = this.listeners.get(message.type) || [];
    handlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error(`Error in WebSocket message handler for ${message.type}:`, error);
      }
    });
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Service Discovery and Registration
export class ServiceRegistry {
  private services: Map<string, { url: string; healthy: boolean; lastCheck: number }> = new Map();
  private healthCheckInterval = 30000; // 30 seconds
  private healthCheckTimer: NodeJS.Timeout | null = null;

  register(serviceName: string, url: string): void {
    this.services.set(serviceName, {
      url,
      healthy: false,
      lastCheck: 0
    });

    if (!this.healthCheckTimer) {
      this.startHealthChecks();
    }
  }

  unregister(serviceName: string): void {
    this.services.delete(serviceName);
    
    if (this.services.size === 0 && this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  getService(serviceName: string): string | null {
    const service = this.services.get(serviceName);
    return service && service.healthy ? service.url : null;
  }

  getAllServices(): Record<string, { url: string; healthy: boolean }> {
    const result: Record<string, { url: string; healthy: boolean }> = {};
    this.services.forEach((service, name) => {
      result[name] = {
        url: service.url,
        healthy: service.healthy
      };
    });
    return result;
  }

  async isHealthy(serviceName: string): Promise<boolean> {
    const service = this.services.get(serviceName);
    if (!service) return false;

    try {
      const client = new ServiceClient(service.url);
      const healthy = await client.healthCheck();
      
      this.services.set(serviceName, {
        ...service,
        healthy,
        lastCheck: Date.now()
      });

      return healthy;
    } catch {
      this.services.set(serviceName, {
        ...service,
        healthy: false,
        lastCheck: Date.now()
      });
      return false;
    }
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      const promises = Array.from(this.services.keys()).map(serviceName => 
        this.isHealthy(serviceName)
      );
      
      await Promise.allSettled(promises);
    }, this.healthCheckInterval);
  }

  stop(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }
}

// Utility functions
export function createRequestId(): string {
  return crypto.randomUUID();
}

export function createCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
  );

  return Promise.race([promise, timeoutPromise]);
}