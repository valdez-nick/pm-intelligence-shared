import { useState, useEffect, useRef, useCallback } from 'react'
import type { DashboardData, WebSocketMessage } from '@/types/dashboard'

interface UseWebSocketReturn {
  data: DashboardData | null
  connected: boolean
  error: string | null
  reconnect: () => void
}

export function useWebSocket(url: string): UseWebSocketReturn {
  const [data, setData] = useState<DashboardData | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(() => {
    try {
      // Clean up any existing connection first
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          return
        }
        wsRef.current.close()
        wsRef.current = null
      }

      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket connected')
        setConnected(true)
        setError(null)
      }

      ws.onmessage = (event) => {
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
        console.log('WebSocket disconnected:', event.code, event.reason)
        setConnected(false)
        
        // Only reconnect if it's an unexpected closure and we're not unmounting
        if (event.code !== 1000 && event.code !== 1001 && wsRef.current === ws) {
          reconnectTimeoutRef.current = setTimeout(() => {
            // Double-check we still want to reconnect
            if (wsRef.current === ws) {
              console.log('Attempting to reconnect...')
              connect()
            }
          }, 3000)
        }
      }

      ws.onerror = (event) => {
        console.error('WebSocket error:', event)
        setError('WebSocket connection failed')
        setConnected(false)
      }

    } catch (err) {
      console.error('Failed to create WebSocket connection:', err)
      setError('Failed to create WebSocket connection')
      setConnected(false)
    }
  }, [url])

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    if (wsRef.current) {
      wsRef.current.close()
    }
    
    setError(null)
    connect()
  }, [connect])

  useEffect(() => {
    // Add a small delay to avoid React StrictMode double-invocation issues
    const connectTimer = setTimeout(() => {
      connect()
    }, 100)

    return () => {
      clearTimeout(connectTimer)
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
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
    error,
    reconnect
  }
}