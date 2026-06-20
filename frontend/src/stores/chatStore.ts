import { create } from 'zustand';
import { ChatSession, ChatMessage, StreamChunk } from '../types';

interface ChatState {
  sessions: ChatSession[];
  activeSession: ChatSession | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  lastError: string | null;

  setSessions: (sessions: ChatSession[]) => void;
  setActiveSession: (session: ChatSession | null) => void;
  addSession: (session: ChatSession) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  setIsStreaming: (streaming: boolean) => void;
  appendStreamContent: (chunk: string) => void;
  clearStreamContent: () => void;
  setLastError: (error: string | null) => void;
  removeSession: (id: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  sessions: [],
  activeSession: null,
  messages: [],
  isStreaming: false,
  streamingContent: '',
  lastError: null,

  setSessions: (sessions) => set({ sessions }),
  setActiveSession: (session) => set({ activeSession: session }),
  addSession: (session) =>
    set((state) => ({ sessions: [session, ...state.sessions] })),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
  appendStreamContent: (chunk) =>
    set((state) => ({ streamingContent: state.streamingContent + chunk })),
  clearStreamContent: () => set({ streamingContent: '' }),
  setLastError: (error) => set({ lastError: error }),
  removeSession: (id) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      activeSession: state.activeSession?.id === id ? null : state.activeSession,
    })),
}));
