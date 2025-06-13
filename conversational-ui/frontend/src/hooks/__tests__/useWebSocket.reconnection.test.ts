import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWebSocket } from '../useWebSocket'

// Enhanced Mock WebSocket with more realistic behavior
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
  static shouldFailConnection = false
  static connectionDelay = 0

  constructor(public url: string) {
    MockWebSocket.instances.push(this)
    
    setTimeout(() => {
      if (MockWebSocket.shouldFailConnection) {
        this.readyState = MockWebSocket.CLOSED
        this.onerror?.(new Event('error'))
        return
      }
      
      this.readyState = MockWebSocket.OPEN
      this.onopen?.(new Event('open'))
    }, MockWebSocket.connectionDelay)
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.(new CloseEvent('close', { code: code || 1000, reason }))
  }

  send(_data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
  }

  // Test helpers
  static reset() {
    MockWebSocket.instances = []
    MockWebSocket.shouldFailConnection = false
    MockWebSocket.connectionDelay = 0
  }

  static simulateNetworkError() {
    const instance = MockWebSocket.instances[MockWebSocket.instances.length - 1]
    if (instance) {
      instance.readyState = MockWebSocket.CLOSED
      // Use setTimeout to simulate async behavior
      setTimeout(() => {
        instance.onclose?.(new CloseEvent('close', { code: 1006, reason: 'Network error' }))
      }, 0)
    }
  }

  static simulateServerDisconnect() {
    const instance = MockWebSocket.instances[MockWebSocket.instances.length - 1]
    if (instance) {
      instance.readyState = MockWebSocket.CLOSED
      setTimeout(() => {
        instance.onclose?.(new CloseEvent('close', { code: 1011, reason: 'Server error' }))
      }, 0)
    }
  }
}

global.WebSocket = MockWebSocket as any

describe('useWebSocket - Reconnection Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    MockWebSocket.reset()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  describe('Exponential Backoff', () => {
    it('should implement exponential backoff with proper delays', async () => {
      const { result } = renderHook(() => useWebSocket('ws://localhost:8000/ws/dashboard'))

      // Initial connection
      await act(async () => {
        vi.advanceTimersByTime(100)
      })
      expect(result.current.connected).toBe(true)

      // Simulate network error (should trigger reconnection)
      act(() => {
        MockWebSocket.simulateNetworkError()
      })
      expect(result.current.connected).toBe(false)

      // First reconnection attempt should be after 1 second
      act(() => {
        vi.advanceTimersByTime(999)
      })
      expect(MockWebSocket.instances).toHaveLength(1) // No new connection yet

      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(MockWebSocket.instances).toHaveLength(2) // New connection attempt

      // Simulate second failure
      act(() => {
        MockWebSocket.simulateNetworkError()
      })

      // Second reconnection should be after 2 seconds
      act(() => {
        vi.advanceTimersByTime(1999)
      })
      expect(MockWebSocket.instances).toHaveLength(2)

      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(MockWebSocket.instances).toHaveLength(3)

      // Third failure - should be 4 seconds
      act(() => {
        MockWebSocket.simulateNetworkError()
      })

      act(() => {
        vi.advanceTimersByTime(3999)
      })
      expect(MockWebSocket.instances).toHaveLength(3)

      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(MockWebSocket.instances).toHaveLength(4)
    })

    it('should cap exponential backoff at maximum delay', async () => {
      // This test will fail initially because current implementation doesn't have max delay cap
      renderHook(() => useWebSocket('ws://localhost:8000/ws/dashboard'))

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      // Simulate multiple failures to test max delay cap
      for (let i = 0; i < 10; i++) {
        act(() => {
          MockWebSocket.simulateNetworkError()
        })
        act(() => {
          vi.advanceTimersByTime(Math.pow(2, i) * 1000)
        })
      }

      // After many failures, should cap at 30 seconds max
      const initialInstances = MockWebSocket.instances.length
      act(() => {
        MockWebSocket.simulateNetworkError()
      })

      // Should not wait more than 30 seconds
      act(() => {
        vi.advanceTimersByTime(30000)
      })
      expect(MockWebSocket.instances.length).toBe(initialInstances + 1)

      // Shouldn't reconnect before 30 seconds even if delay would be higher
      act(() => {
        MockWebSocket.simulateNetworkError()
      })
      act(() => {
        vi.advanceTimersByTime(29999)
      })
      expect(MockWebSocket.instances.length).toBe(initialInstances + 1)
    })

    it('should reset backoff delay on successful connection', async () => {
      // This test will fail initially because current implementation doesn't reset backoff
      const { result } = renderHook(() => useWebSocket('ws://localhost:8000/ws/dashboard'))

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      // Cause a few failures to increase backoff
      act(() => {
        MockWebSocket.simulateNetworkError()
      })
      act(() => {
        vi.advanceTimersByTime(1000) // First retry
      })
      
      act(() => {
        MockWebSocket.simulateNetworkError()
      })
      act(() => {
        vi.advanceTimersByTime(2000) // Second retry (2s delay)
      })

      // Now let connection succeed
      await act(async () => {
        vi.advanceTimersByTime(100)
      })
      expect(result.current.connected).toBe(true)

      // Next failure should start from 1 second again, not continue from previous backoff
      act(() => {
        MockWebSocket.simulateNetworkError()
      })
      
      const instancesBefore = MockWebSocket.instances.length
      act(() => {
        vi.advanceTimersByTime(1000) // Should reconnect after 1 second, not 4
      })
      expect(MockWebSocket.instances.length).toBe(instancesBefore + 1)
    })
  })

  describe('Connection State Management', () => {
    it('should provide detailed connection states', async () => {
      // This test will fail because current implementation doesn't have detailed states
      const { result } = renderHook(() => useWebSocket('ws://localhost:8000/ws/dashboard'))

      // Initially should be 'disconnected', then 'connecting' after initialization
      expect(result.current.connectionState).toBe('disconnected')
      expect(result.current.connected).toBe(false)

      await act(async () => {
        vi.advanceTimersByTime(100) // Wait for initial connection timer
      })

      expect(result.current.connectionState).toBe('connected')
      expect(result.current.connected).toBe(true)

      await act(async () => {
        MockWebSocket.simulateNetworkError()
        vi.advanceTimersByTime(1) // Allow the async close to trigger
      })

      expect(result.current.connectionState).toBe('disconnected')
      expect(result.current.connected).toBe(false)

      // Should show 'reconnecting' during reconnection attempts
      await act(async () => {
        vi.advanceTimersByTime(1000) // Wait for first reconnection
        vi.advanceTimersByTime(1) // Allow the reconnection to start
      })
      expect(result.current.connectionState).toBe('reconnecting')
    })

    it('should track reconnection attempts', async () => {
      // This test will fail because current implementation doesn't track attempts
      const { result } = renderHook(() => useWebSocket('ws://localhost:8000/ws/dashboard'))

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      expect(result.current.reconnectAttempts).toBe(0)

      // First failure
      act(() => {
        MockWebSocket.simulateNetworkError()
      })
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(result.current.reconnectAttempts).toBe(1)

      // Second failure
      act(() => {
        MockWebSocket.simulateNetworkError()
      })
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(result.current.reconnectAttempts).toBe(2)

      // Successful connection should reset counter
      await act(async () => {
        vi.advanceTimersByTime(100)
      })
      expect(result.current.reconnectAttempts).toBe(0)
    })

    it('should stop reconnecting after max attempts', async () => {
      // This test will fail because current implementation doesn't have max attempts limit
      const { result } = renderHook(() => useWebSocket('ws://localhost:8000/ws/dashboard'))
      MockWebSocket.shouldFailConnection = true

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      // Should attempt up to 5 times by default
      for (let i = 1; i <= 6; i++) {
        act(() => {
          vi.advanceTimersByTime(Math.pow(2, i - 1) * 1000)
        })
        
        if (i <= 5) {
          expect(result.current.reconnectAttempts).toBe(i)
          expect(result.current.connectionState).toBe('reconnecting')
        }
      }

      // After 5 attempts, should give up
      expect(result.current.connectionState).toBe('failed')
      expect(result.current.error).toContain('Max reconnection attempts')
    })
  })

  describe('Enhanced Error Handling', () => {
    it('should provide specific error messages for different failure types', async () => {
      // This test will fail because current implementation doesn't categorize errors
      const { result } = renderHook(() => useWebSocket('ws://localhost:8000/ws/dashboard'))

      await act(async () => {
        vi.advanceTimersByTime(100) // Let initial connection succeed
      })

      // Network error
      await act(async () => {
        const instance = MockWebSocket.instances[0]
        if (instance) {
          instance.readyState = MockWebSocket.CLOSED
          instance.onclose?.(new CloseEvent('close', { code: 1006 }))
        }
        vi.advanceTimersByTime(1) // Allow error processing
      })
      
      expect(result.current.error).not.toBeNull()
      if (result.current.error) {
        expect(result.current.error).toContain('Network error')
      }
      expect(result.current.errorType).toBe('network')

      // Server error
      await act(async () => {
        result.current.reconnect()
        vi.advanceTimersByTime(100) // Let reconnection succeed
      })

      await act(async () => {
        const instance = MockWebSocket.instances[MockWebSocket.instances.length - 1]
        if (instance) {
          instance.readyState = MockWebSocket.CLOSED
          instance.onclose?.(new CloseEvent('close', { code: 1011 }))
        }
        vi.advanceTimersByTime(1) // Allow error processing
      })
      
      expect(result.current.error).not.toBeNull()
      if (result.current.error) {
        expect(result.current.error).toContain('Server error')
      }
      expect(result.current.errorType).toBe('server')
    })

    it('should handle connection timeout', async () => {
      // This test will fail because current implementation doesn't have connection timeout
      MockWebSocket.connectionDelay = 15000 // 15 second delay
      const { result } = renderHook(() => useWebSocket('ws://localhost:8000/ws/dashboard'))

      // Should timeout after 10 seconds and show error
      act(() => {
        vi.advanceTimersByTime(10000)
      })

      expect(result.current.connectionState).toBe('failed')
      expect(result.current.error).toContain('Connection timeout')
      expect(result.current.errorType).toBe('timeout')
    })
  })

  describe('Jitter Implementation', () => {
    it('should add random jitter to prevent thundering herd', async () => {
      // This test will fail because current implementation doesn't have jitter
      const delays: number[] = []
      const originalSetTimeout = global.setTimeout
      
      // Mock setTimeout to capture delays
      global.setTimeout = vi.fn((callback, delay) => {
        delays.push(delay as number)
        return originalSetTimeout(callback, delay)
      }) as any

      // Create multiple WebSocket instances that will fail
      const hooks = []
      for (let i = 0; i < 5; i++) {
        const { result } = renderHook(() => useWebSocket(`ws://localhost:800${i}/ws/dashboard`))
        hooks.push(result)
      }

      // Wait for initial connections
      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      // Simulate network failure for all
      act(() => {
        MockWebSocket.instances.forEach(instance => {
          instance.readyState = MockWebSocket.CLOSED
          instance.onclose?.(new CloseEvent('close', { code: 1006 }))
        })
      })

      // Check that reconnection delays have jitter (not all exactly 1000ms)
      const reconnectDelays = delays.filter(delay => delay >= 900 && delay <= 1100)
      expect(reconnectDelays.length).toBeGreaterThan(0)
      
      // Should have some variation in delays (not all identical)
      const uniqueDelays = new Set(reconnectDelays)
      expect(uniqueDelays.size).toBeGreaterThan(1)

      global.setTimeout = originalSetTimeout
    })
  })
})