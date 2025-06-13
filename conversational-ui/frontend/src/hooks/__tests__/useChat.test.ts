import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChat } from '../useChat'
import { apiClient } from '@/services/api'

// Mock the API client
vi.mock('@/services/api', () => ({
  apiClient: {
    conversations: {
      chat: vi.fn(),
      createSession: vi.fn(),
      getSession: vi.fn(),
    }
  }
}))

const mockApiClient = apiClient as any // TODO: Fix jest types

describe('useChat Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('should initialize with empty messages and no session', () => {
    const { result } = renderHook(() => useChat())

    expect(result.current.messages).toEqual([])
    expect(result.current.sessionId).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should create a new session when sending first message', async () => {
    const mockSession = {
      session_id: 'new-session-123',
      created_at: '2024-01-15T10:00:00Z',
      last_activity: '2024-01-15T10:00:00Z',
      message_count: 0,
      context: {}
    }

    const mockChatResponse = {
      session_id: 'new-session-123',
      message: 'Hello',
      response: 'Hi there! How can I help you?',
      timestamp: '2024-01-15T10:00:00Z',
      tools_used: [],
      artifacts: {}
    }

    mockApiClient.conversations.createSession.mockResolvedValueOnce(mockSession)
    mockApiClient.conversations.chat.mockResolvedValueOnce(mockChatResponse)

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(mockApiClient.conversations.createSession).toHaveBeenCalledOnce()
    expect(mockApiClient.conversations.chat).toHaveBeenCalledWith({
      message: 'Hello',
      session_id: 'new-session-123'
    })

    expect(result.current.sessionId).toBe('new-session-123')
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0].role).toBe('user')
    expect(result.current.messages[0].content).toBe('Hello')
    expect(result.current.messages[1].role).toBe('assistant')
    expect(result.current.messages[1].content).toBe('Hi there! How can I help you?')
  })

  it('should use existing session for subsequent messages', async () => {
    const mockChatResponse = {
      session_id: 'existing-session-456',
      message: 'Second message',
      response: 'Got it!',
      timestamp: '2024-01-15T10:01:00Z',
      tools_used: [],
      artifacts: {}
    }

    mockApiClient.conversations.chat.mockResolvedValueOnce(mockChatResponse)

    const { result } = renderHook(() => useChat('existing-session-456'))

    await act(async () => {
      await result.current.sendMessage('Second message')
    })

    expect(mockApiClient.conversations.createSession).not.toHaveBeenCalled()
    expect(mockApiClient.conversations.chat).toHaveBeenCalledWith({
      message: 'Second message',
      session_id: 'existing-session-456'
    })
  })

  it('should handle message sending errors', async () => {
    const error = new Error('API Error')
    mockApiClient.conversations.createSession.mockRejectedValueOnce(error)

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(result.current.error).toBe('API Error')
    expect(result.current.isLoading).toBe(false)
    expect(result.current.messages).toHaveLength(1) // Only user message added
  })

  it('should clear messages when clearing chat', () => {
    const { result } = renderHook(() => useChat())

    // Add some mock messages
    act(() => {
      result.current.clearMessages()
    })

    expect(result.current.messages).toEqual([])
    expect(result.current.sessionId).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('should show loading state while sending message', async () => {
    const mockSession = {
      session_id: 'test-session',
      created_at: '2024-01-15T10:00:00Z',
      last_activity: '2024-01-15T10:00:00Z',
      message_count: 0,
      context: {}
    }

    // Make API calls hang to test loading state
    mockApiClient.conversations.createSession.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockSession), 100))
    )

    const { result } = renderHook(() => useChat())

    // Start sending message
    act(() => {
      result.current.sendMessage('Hello')
    })

    // Should be loading
    expect(result.current.isLoading).toBe(true)

    // Wait for completion
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150))
    })

    expect(result.current.isLoading).toBe(false)
  })

  it('should persist session ID in localStorage', async () => {
    const mockSession = {
      session_id: 'persistent-session',
      created_at: '2024-01-15T10:00:00Z',
      last_activity: '2024-01-15T10:00:00Z',
      message_count: 0,
      context: {}
    }

    const mockChatResponse = {
      session_id: 'persistent-session',
      message: 'Hello',
      response: 'Hi!',
      timestamp: '2024-01-15T10:00:00Z',
      tools_used: [],
      artifacts: {}
    }

    mockApiClient.conversations.createSession.mockResolvedValueOnce(mockSession)
    mockApiClient.conversations.chat.mockResolvedValueOnce(mockChatResponse)

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'pm-chat-session-id',
      'persistent-session'
    )
  })

  it('should restore session from localStorage on initialization', () => {
    localStorage.setItem('pm-chat-session-id', 'restored-session')

    const { result } = renderHook(() => useChat())

    expect(result.current.sessionId).toBe('restored-session')
  })
})