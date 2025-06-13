import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWebSocket } from '../useWebSocket'

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null

  static instances: MockWebSocket[] = []

  constructor(public url: string) {
    MockWebSocket.instances.push(this)
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      this.onopen?.(new Event('open'))
    }, 0)
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.(new CloseEvent('close', { code: 1000 }))
  }

  send(_data: string) {
    // Mock send implementation
  }
}

global.WebSocket = MockWebSocket as any

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    MockWebSocket.instances = []
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('should connect to WebSocket on mount', async () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:8000/ws/dashboard'))

    expect(result.current.connected).toBe(false)
    expect(result.current.data).toBe(null)
    expect(result.current.error).toBe(null)

    // Wait for connection
    await act(async () => {
      vi.advanceTimersByTime(100) // Initial delay + connection time
    })

    expect(result.current.connected).toBe(true)
  })

  it('should handle incoming messages', async () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:8000/ws/dashboard'))

    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    const mockData = {
      type: 'dashboard_update',
      data: {
        workflows: [],
        systemMetrics: {
          totalWorkflows: 5,
          activeWorkflows: 2,
          completedToday: 3,
          failedToday: 0,
          averageCompletionTime: 300,
          systemLoad: 0.45
        }
      },
      timestamp: '2024-01-15T10:00:00Z'
    }

    // Simulate message
    act(() => {
      const ws = MockWebSocket.instances[0]
      if (ws?.onmessage) {
        ws.onmessage(new MessageEvent('message', { 
          data: JSON.stringify(mockData) 
        }))
      }
    })

    expect(result.current.data).toEqual(mockData.data)
  })

  it('should handle connection errors', async () => {
    const { result } = renderHook(() => useWebSocket('ws://invalid-url'))

    await act(async () => {
      vi.advanceTimersByTime(100)
      const ws = MockWebSocket.instances[0]
      if (ws?.onerror) {
        ws.onerror(new Event('error'))
      }
    })

    expect(result.current.connected).toBe(false)
    expect(result.current.error).toBeTruthy()
  })

  it('should reconnect when reconnect is called', async () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:8000/ws/dashboard'))

    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current.connected).toBe(true)

    // Simulate disconnect
    await act(async () => {
      const ws = MockWebSocket.instances[0]
      if (ws?.onclose) {
        ws.readyState = MockWebSocket.CLOSED
        ws.onclose(new CloseEvent('close', { code: 1006 }))
      }
      vi.advanceTimersByTime(1)
    })

    expect(result.current.connected).toBe(false)

    // Test reconnect
    await act(async () => {
      result.current.reconnect()
      vi.advanceTimersByTime(100)
    })

    expect(result.current.connected).toBe(true)
  })

  it('should cleanup on unmount', async () => {
    const { unmount } = renderHook(() => useWebSocket('ws://localhost:8000/ws/dashboard'))

    await act(async () => {
      vi.advanceTimersByTime(100) // Let connection establish
    })

    const closeSpy = vi.spyOn(MockWebSocket.prototype, 'close')
    
    unmount()

    expect(closeSpy).toHaveBeenCalled()
  })
})