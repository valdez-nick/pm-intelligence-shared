import { useState, useEffect, useRef, useCallback } from 'react'

interface CollaborationMessage {
  type: string;
  session_id?: string;
  agent_id?: string;
  organization_id?: string;
  data: any;
  timestamp: string;
}

interface CollaborationWebSocketReturn {
  connected: boolean;
  error: string | null;
  messages: CollaborationMessage[];
  sendMessage: (message: string) => void;
  reconnect: () => void;
  clearMessages: () => void;
}

export function useCollaborationWebSocket(
  endpoint: string, // e.g., '/ws/collaboration/session/123' or '/ws/collaboration/organization/demo-org'
  autoConnect = true
): CollaborationWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<CollaborationMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    try {
      // Clean up any existing connection
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          return;
        }
        wsRef.current.close();
        wsRef.current = null;
      }

      // Construct WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}${endpoint}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Collaboration WebSocket connected:', endpoint);
        setConnected(true);
        setError(null);
        reconnectAttempts.current = 0;

        // Send ping to verify connection
        ws.send('ping');
      };

      ws.onmessage = (event) => {
        try {
          if (event.data === 'pong') {
            return; // Handle ping/pong
          }

          const message: CollaborationMessage = JSON.parse(event.data);
          
          setMessages(prev => {
            // Limit messages to last 100 to prevent memory issues
            const newMessages = [...prev, message];
            return newMessages.slice(-100);
          });

          // Log important events
          if (message.type === 'collaboration_started') {
            console.log('Collaboration started:', message.session_id);
          } else if (message.type === 'collaboration_completed') {
            console.log('Collaboration completed:', message.session_id);
          } else if (message.type === 'conflict_detected') {
            console.warn('Conflict detected:', message.data);
          }

        } catch (err) {
          console.error('Failed to parse collaboration WebSocket message:', err);
        }
      };

      ws.onclose = (event) => {
        console.log('Collaboration WebSocket disconnected:', event.code, event.reason);
        setConnected(false);
        
        // Only reconnect if it's an unexpected closure and we haven't exceeded max attempts
        if (
          event.code !== 1000 && 
          event.code !== 1001 && 
          wsRef.current === ws &&
          reconnectAttempts.current < maxReconnectAttempts
        ) {
          reconnectAttempts.current += 1;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000); // Exponential backoff
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (wsRef.current === ws) {
              console.log(`Attempting to reconnect... (attempt ${reconnectAttempts.current})`);
              connect();
            }
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          setError('Max reconnection attempts reached');
        }
      };

      ws.onerror = (event) => {
        console.error('Collaboration WebSocket error:', event);
        setError('WebSocket connection failed');
        setConnected(false);
      };

    } catch (err) {
      console.error('Failed to create collaboration WebSocket connection:', err);
      setError('Failed to create WebSocket connection');
      setConnected(false);
    }
  }, [endpoint]);

  const sendMessage = useCallback((message: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(message);
    } else {
      console.warn('WebSocket not connected, cannot send message:', message);
    }
  }, []);

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    reconnectAttempts.current = 0;
    setError(null);
    connect();
  }, [connect]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  useEffect(() => {
    if (autoConnect) {
      const connectTimer = setTimeout(() => {
        connect();
      }, 100);

      return () => {
        clearTimeout(connectTimer);
      };
    }
  }, [connect, autoConnect]);

  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, 'Component unmounting');
        wsRef.current = null;
      }
    };
  }, []);

  return {
    connected,
    error,
    messages,
    sendMessage,
    reconnect,
    clearMessages
  };
}

// Hook for session-specific collaboration updates
export function useCollaborationSession(sessionId: string) {
  return useCollaborationWebSocket(`/ws/collaboration/session/${sessionId}`);
}

// Hook for agent-specific updates
export function useAgentWebSocket(agentId: string) {
  return useCollaborationWebSocket(`/ws/collaboration/agent/${agentId}`);
}

// Hook for organization-wide collaboration updates
export function useOrganizationCollaboration(organizationId: string) {
  return useCollaborationWebSocket(`/ws/collaboration/organization/${organizationId}`);
}