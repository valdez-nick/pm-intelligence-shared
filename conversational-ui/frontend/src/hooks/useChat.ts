import { useState, useCallback, useEffect } from 'react'
import { apiClient } from '@/services/api'
import type { ChatMessage } from '@/types/api'

interface UseChatReturn {
  messages: ChatMessage[]
  sessionId: string | null
  isLoading: boolean
  error: string | null
  sendMessage: (content: string) => Promise<void>
  clearMessages: () => void
  clearError: () => void
}

const SESSION_STORAGE_KEY = 'pm-chat-session-id'

export function useChat(initialSessionId?: string): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId, setSessionId] = useState<string | null>(() => {
    if (initialSessionId) return initialSessionId
    return localStorage.getItem(SESSION_STORAGE_KEY) || null
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Persist session ID to localStorage
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId)
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY)
    }
  }, [sessionId])

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return

    setIsLoading(true)
    setError(null)

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
      status: 'sending'
    }

    setMessages(prev => [...prev, userMessage])

    try {
      let currentSessionId = sessionId

      // Create session if we don't have one
      if (!currentSessionId) {
        const session = await apiClient.conversations.createSession()
        currentSessionId = session.session_id
        setSessionId(currentSessionId)
      }

      // Send message to API - try MCP endpoint first, fall back to simple
      let response;
      let usedFallback = false;
      try {
        // Try the new direct MCP integration endpoint
        response = await fetch('/api/v1/conversations/chat/mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content.trim(),
            session_id: currentSessionId!
          })
        }).then(r => r.json());
        console.log('MCP endpoint succeeded with full PM intelligence');
      } catch (error) {
        console.log('MCP endpoint failed, falling back to simple endpoint:', error);
        usedFallback = true;
        // Fall back to simple endpoint
        response = await fetch('/api/v1/conversations/chat/simple', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content.trim(),
            session_id: currentSessionId!
          })
        }).then(r => r.json());
      }

      // Update user message status
      setMessages(prev =>
        prev.map(msg =>
          msg.id === userMessage.id
            ? { ...msg, status: 'sent' }
            : msg
        )
      )

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: usedFallback 
          ? `🔄 *[Fallback Mode]* ${response.response}` 
          : `⚡ *[Full PM Intelligence]* ${response.response}`,
        timestamp: response.timestamp,
        tools_used: response.tools_used,
        artifacts: response.artifacts
      }

      setMessages(prev => [...prev, assistantMessage])

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message'
      setError(errorMessage)

      // Update user message status to error
      setMessages(prev =>
        prev.map(msg =>
          msg.id === userMessage.id
            ? { ...msg, status: 'error' }
            : msg
        )
      )
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  const clearMessages = useCallback(() => {
    setMessages([])
    setSessionId(null)
    setError(null)
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    messages,
    sessionId,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    clearError,
  }
}