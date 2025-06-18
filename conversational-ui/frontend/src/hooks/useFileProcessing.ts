import { useEffect, useState, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { FileProcessingUpdate } from '../types/files'

interface UseFileProcessingOptions {
  enabled?: boolean
  url?: string
  reconnectAttempts?: number
  reconnectDelay?: number
}

interface FileProcessingState {
  connected: boolean
  updates: Map<string, FileProcessingUpdate[]>
  error: Error | null
}

export const useFileProcessing = (options: UseFileProcessingOptions = {}) => {
  const {
    enabled = true,
    url = process.env.REACT_APP_WEBSOCKET_URL || '/ws',
    reconnectAttempts = 3,
    reconnectDelay = 1000
  } = options

  const [state, setState] = useState<FileProcessingState>({
    connected: false,
    updates: new Map(),
    error: null
  })

  const socketRef = useRef<Socket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)

  const addUpdate = useCallback((update: FileProcessingUpdate) => {
    setState(prev => {
      const updates = new Map(prev.updates)
      const fileUpdates = updates.get(update.fileId) || []
      updates.set(update.fileId, [...fileUpdates, update])
      
      return {
        ...prev,
        updates
      }
    })
  }, [])

  const clearUpdates = useCallback((fileId?: string) => {
    setState(prev => {
      if (fileId) {
        const updates = new Map(prev.updates)
        updates.delete(fileId)
        return { ...prev, updates }
      } else {
        return { ...prev, updates: new Map() }
      }
    })
  }, [])

  const connect = useCallback(() => {
    if (!enabled || socketRef.current?.connected) return

    try {
      const socket = io(url, {
        transports: ['websocket'],
        reconnection: false, // We'll handle reconnection manually
        auth: {
          token: localStorage.getItem('auth_token')
        }
      })

      socket.on('connect', () => {
        console.log('WebSocket connected for file processing')
        setState(prev => ({ ...prev, connected: true, error: null }))
        reconnectAttemptsRef.current = 0
      })

      socket.on('disconnect', () => {
        console.log('WebSocket disconnected')
        setState(prev => ({ ...prev, connected: false }))
        
        // Attempt to reconnect
        if (reconnectAttemptsRef.current < reconnectAttempts) {
          reconnectAttemptsRef.current++
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`Reconnecting... (attempt ${reconnectAttemptsRef.current})`)
            connect()
          }, reconnectDelay * reconnectAttemptsRef.current)
        }
      })

      socket.on('error', (error) => {
        console.error('WebSocket error:', error)
        setState(prev => ({ ...prev, error: new Error('WebSocket connection failed') }))
      })

      // File processing events
      socket.on('file.processing.started', (data: FileProcessingUpdate) => {
        console.log('Processing started:', data)
        addUpdate(data)
      })

      socket.on('file.processing.progress', (data: FileProcessingUpdate) => {
        console.log('Processing progress:', data)
        addUpdate(data)
      })

      socket.on('file.processing.completed', (data: FileProcessingUpdate) => {
        console.log('Processing completed:', data)
        addUpdate(data)
      })

      socket.on('file.processing.failed', (data: FileProcessingUpdate) => {
        console.log('Processing failed:', data)
        addUpdate(data)
      })

      socketRef.current = socket
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error : new Error('Connection failed') 
      }))
    }
  }, [enabled, url, reconnectAttempts, reconnectDelay, addUpdate])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }

    setState(prev => ({ ...prev, connected: false }))
  }, [])

  const subscribeToFile = useCallback((fileId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('file.subscribe', { fileId })
    }
  }, [])

  const unsubscribeFromFile = useCallback((fileId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('file.unsubscribe', { fileId })
    }
  }, [])

  const getFileUpdates = useCallback((fileId: string): FileProcessingUpdate[] => {
    return state.updates.get(fileId) || []
  }, [state.updates])

  const getLatestUpdate = useCallback((fileId: string): FileProcessingUpdate | null => {
    const updates = getFileUpdates(fileId)
    return updates.length > 0 ? updates[updates.length - 1] : null
  }, [getFileUpdates])

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    connected: state.connected,
    error: state.error,
    updates: state.updates,
    subscribeToFile,
    unsubscribeFromFile,
    getFileUpdates,
    getLatestUpdate,
    clearUpdates,
    reconnect: connect
  }
}