// Test utility types

export interface MockWebSocketInstance {
  url: string
  readyState: number
  send: any // Mock function
  close: any // Mock function  
  onopen?: ((ev: Event) => void) | null
  onclose?: ((ev: CloseEvent) => void) | null
  onerror?: ((ev: Event) => void) | null
  onmessage?: ((ev: MessageEvent) => void) | null
}

export interface MockWebSocketConstructor {
  new (url: string): MockWebSocketInstance
  instances?: MockWebSocketInstance[]
  CONNECTING: 0
  OPEN: 1
  CLOSING: 2
  CLOSED: 3
}

// Mocked function type for testing
export type MockedFunction<T extends (...args: any[]) => any> = T & {
  mockResolvedValue?: (value: any) => any
  mockRejectedValue?: (value: any) => any
}

// Type guard for error objects
export function isError(error: unknown): error is Error {
  return error instanceof Error
}

// Type guard for API errors
export function isAPIError(error: unknown): error is { status: number; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'message' in error
  )
}