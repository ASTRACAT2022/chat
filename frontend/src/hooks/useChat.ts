import { useEffect, useCallback, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useChatStore } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';
import { ChatMessage, ChatSession } from '../types';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

export function useChat() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const userId = useAuthStore((s) => s.user?.id);
  const token = useAuthStore((s) => s.token);
  const {
    setMessages,
    addMessage,
    setIsStreaming,
    appendStreamContent,
    clearStreamContent,
    setSessions,
    addSession,
    setActiveSession,
    setLastError,
  } = useChatStore();

  useEffect(() => {
    if (!userId || !token) return;

    const socket = io(SOCKET_URL, {
      query: { userId },
      auth: { token },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('session:list');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      setIsConnected(false);
    });

    socket.on('chat:chunk', (data: { sessionId: string; content: string; done: boolean }) => {
      if (data.done) {
        const fullContent = useChatStore.getState().streamingContent;
        if (fullContent) {
          addMessage({
            id: crypto.randomUUID(),
            sessionId: data.sessionId,
            role: 'assistant',
            content: fullContent,
            createdAt: new Date().toISOString(),
          } as ChatMessage);
          clearStreamContent();
        }
        setIsStreaming(false);
        return;
      }
      appendStreamContent(data.content);
    });

    socket.on('chat:error', (data: { error: string }) => {
      console.error('Chat error:', data.error);
      setLastError(data.error);
      setIsStreaming(false);
    });

    socket.on('session:list', (sessions: ChatSession[]) => {
      setSessions(sessions);
    });

    socket.on('session:created', (session: ChatSession) => {
      addSession(session);
      setActiveSession(session);
    });

    socket.on('session:messages', (messages: ChatMessage[]) => {
      setMessages(messages);
    });

    socket.on('session:updated', (data: { id: string; title: string }) => {
      const store = useChatStore.getState();
      store.setSessions(store.sessions.map((s) => s.id === data.id ? { ...s, title: data.title } : s));
      if (store.activeSession?.id === data.id) {
        store.setActiveSession({ ...store.activeSession, title: data.title });
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [userId, token]);

  const sendMessage = useCallback(
    (content: string, provider = 'openrouter', model = 'openrouter/auto', sessionIdOverride?: string) => {
      const session = useChatStore.getState().activeSession;
      const sid = sessionIdOverride || session?.id;
      if (!sid || !socketRef.current) return;

      clearStreamContent();
      setLastError(null);
      setIsStreaming(true);

      addMessage({
        id: crypto.randomUUID(),
        sessionId: sid,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      } as ChatMessage);

      socketRef.current.emit('chat:send', {
        sessionId: sid,
        provider,
        model,
        content,
      });
    },
    [],
  );

  const loadMessages = useCallback((sessionId: string) => {
    socketRef.current?.emit('session:messages', { sessionId });
  }, []);

  const createSession = useCallback((title?: string, model?: string) => {
    socketRef.current?.emit('session:create', { title, model });
  }, []);

  const listSessions = useCallback(() => {
    socketRef.current?.emit('session:list');
  }, []);

  return {
    sendMessage,
    loadMessages,
    createSession,
    listSessions,
    isConnected,
    socket: socketRef.current,
  };
}
