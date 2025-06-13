import { useState, useEffect, useRef, useCallback } from 'react'
import type { DashboardData, WebSocketMessage } from '@/types/dashboard'

// Enhanced connection states for better user feedback
type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'failed'
type ErrorType = 'network' | 'server' | 'timeout' | 'generic'

interface UseWebSocketReturn {
  data: DashboardData | null
  connected: boolean
  connectionState: ConnectionState
  error: string | null
  errorType: ErrorType | null
  reconnectAttempts: number
  reconnect: () => void
}

// Configuration for reconnection behavior
interface ReconnectionConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  jitterMax: number
  connectionTimeout: number
}

export function useWebSocket(
  url: string, 
  config: Partial<ReconnectionConfig> = {}
): UseWebSocketReturn {
  const [data, setData] = useState<DashboardData | null>(null)
  const [connected, setConnected] = useState(false)
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [errorType, setErrorType] = useState<ErrorType | null>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)
  
  // Default configuration with user overrides
  const reconnectConfig: ReconnectionConfig = {
    maxAttempts: 5,
    baseDelay: 1000,
    maxDelay: 30000,
    jitterMax: 200,
    connectionTimeout: 10000,
    ...config
  }

  // Helper function to add jitter to prevent thundering herd
  const addJitter = useCallback((delay: number): number => {
    const jitter = Math.random() * reconnectConfig.jitterMax
    return delay + jitter
  }, [reconnectConfig.jitterMax])

  // Helper function to calculate exponential backoff delay
  const calculateDelay = useCallback((attempt: number): number => {
    const exponentialDelay = reconnectConfig.baseDelay * Math.pow(2, attempt)
    const cappedDelay = Math.min(exponentialDelay, reconnectConfig.maxDelay)
    return addJitter(cappedDelay)
  }, [reconnectConfig.baseDelay, reconnectConfig.maxDelay, addJitter])

  // Helper function to categorize error types
  const categorizeError = useCallback((code: number): { type: ErrorType; message: string } => {
    switch (code) {
      case 1006:
        return { type: 'network', message: 'Network error - connection lost unexpectedly' }
      case 1011:
      case 1012:
      case 1013:
        return { type: 'server', message: 'Server error - please try again later' }
      case 1002:
      case 1003:
        return { type: 'server', message: 'Protocol error - invalid data received' }
      default:
        return { type: 'generic', message: 'Connection closed unexpectedly' }
    }
  }, [])

  const connect = useCallback((isReconnect = false) => {
    if (!isMountedRef.current) return
    
    try {
      // Clear any existing timeouts
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current)
        connectionTimeoutRef.current = null
      }
      
      // Clean up any existing connection first
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          return
        }
        wsRef.current.close()
        wsRef.current = null
      }

      // Update connection state
      setConnectionState(isReconnect ? 'reconnecting' : 'connecting')
      setConnected(false)
      setError(null)
      setErrorType(null)

      const ws = new WebSocket(url)
      wsRef.current = ws

      // Set connection timeout
      connectionTimeoutRef.current = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close()
          setConnectionState('failed')
          setError('Connection timeout - server not responding')
          setErrorType('timeout')
          scheduleReconnect()
        }
      }, reconnectConfig.connectionTimeout)

      ws.onopen = () => {
        if (!isMountedRef.current) return
        
        console.log('WebSocket connected')
        
        // Clear connection timeout
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current)
          connectionTimeoutRef.current = null
        }
        
        setConnected(true)
        setConnectionState('connected')
        setError(null)
        setErrorType(null)
        setReconnectAttempts(0) // Reset attempts on successful connection
      }

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return
        
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          
          switch (message.type) {
            case 'dashboard_update':
              setData(message.data as DashboardData)
              break
            case 'workflow_status':
              // Update specific workflow status
              setData(prevData => {
                if (!prevData) return prevData
                const workflowUpdate = message.data as any
                return {
                  ...prevData,
                  workflows: prevData.workflows.map(w => 
                    w.id === workflowUpdate.id ? { ...w, ...workflowUpdate } : w
                  )
                }
              })
              break
            case 'system_metrics':
              // Update system metrics
              setData(prevData => {
                if (!prevData) return prevData
                return {
                  ...prevData,
                  systemMetrics: message.data as any
                }
              })
              break
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
        }
      }

      ws.onclose = (event) => {
        if (!isMountedRef.current) return
        
        console.log('WebSocket disconnected:', event.code, event.reason)
        setConnected(false)
        setConnectionState('disconnected')
        
        // Clear connection timeout
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current)
          connectionTimeoutRef.current = null
        }
        
        // Only reconnect if it's an unexpected closure and we haven't exceeded max attempts
        if (event.code !== 1000 && event.code !== 1001 && wsRef.current === ws) {
          const errorInfo = categorizeError(event.code)
          setError(errorInfo.message)
          setErrorType(errorInfo.type)
          
          scheduleReconnect()
        }
      }

      ws.onerror = (event) => {
        if (!isMountedRef.current) return
        
        console.error('WebSocket error:', event)
        setError('WebSocket connection failed')
        setErrorType('generic')
        setConnected(false)
        setConnectionState('disconnected')
      }

    } catch (err) {
      console.error('Failed to create WebSocket connection:', err)
      setError('Failed to create WebSocket connection')
      setErrorType('generic')
      setConnected(false)
      setConnectionState('failed')
    }
  }, [url, reconnectConfig.connectionTimeout, categorizeError])

  // Enhanced reconnection logic with exponential backoff
  const scheduleReconnect = useCallback(() => {
    if (!isMountedRef.current) return
    
    setReconnectAttempts(prev => {
      const newAttempts = prev + 1
      
      if (newAttempts >= reconnectConfig.maxAttempts) {
        setConnectionState('failed')
        setError(`Max reconnection attempts (${reconnectConfig.maxAttempts}) reached`)
        return newAttempts
      }
      
      const delay = calculateDelay(newAttempts - 1)
      console.log(`Attempting to reconnect... (attempt ${newAttempts}) in ${Math.round(delay)}ms`)
      
      reconnectTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && wsRef.current) {
          connect(true)
        }
      }, delay)
      
      return newAttempts
    })
  }, [reconnectConfig.maxAttempts, calculateDelay, connect])

  const reconnect = useCallback(() => {
    // Clear any pending reconnection attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current)
      connectionTimeoutRef.current = null
    }
    
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual reconnect')
    }
    
    // Reset state and attempt fresh connection
    setError(null)
    setErrorType(null)
    setReconnectAttempts(0)
    connect(false)
  }, [connect])

  useEffect(() => {
    isMountedRef.current = true
    
    // Add a small delay to avoid React StrictMode double-invocation issues
    const connectTimer = setTimeout(() => {
      connect(false)
    }, 100)

    return () => {
      isMountedRef.current = false
      
      clearTimeout(connectTimer)
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current)
        connectionTimeoutRef.current = null
      }
      
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, 'Component unmounting')
        wsRef.current = null
      }
    }
  }, [connect])

  return {
    data,
    connected,
    connectionState,
    error,
    errorType,
    reconnectAttempts,
    reconnect
  }
}