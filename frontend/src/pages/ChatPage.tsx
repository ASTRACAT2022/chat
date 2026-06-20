import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, History, MessageSquare, Trash2, Sparkles, WifiOff, AlertCircle, RefreshCw, Globe, Brain } from 'lucide-react';
import { api } from '../lib/api';
import { useChatStore } from '../stores/chatStore';
import { useChat } from '../hooks/useChat';
import { useModelStore, detectTaskType, autoPickModel } from '../stores/modelStore';
import { ModelInfo } from '../types';
import ChatMessage from '../components/chat/ChatMessage';
import Starfield from '../components/chat/Starfield';
import ModelSelector from '../components/chat/ModelSelector';

export default function ChatPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [chatMode, setChatMode] = useState(false);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('openrouter/auto');
  const [selectedProvider, setSelectedProvider] = useState('openrouter');
  const [showSidebar, setShowSidebar] = useState(false);
  const [reasoning, setReasoning] = useState(false);
  const [webSearch, setWebSearch] = useState(false);

  const {
    sessions, setSessions, activeSession, setActiveSession,
    messages, setMessages, isStreaming, streamingContent,
    addMessage, removeSession, lastError, setLastError,
  } = useChatStore();
  const { sendMessage, loadMessages, isConnected } = useChat();
  const {
    autoMode, lastChangedModel, lastChangedProvider,
    setAutoMode,
  } = useModelStore();

  const { data: allModels } = useQuery({
    queryKey: ['all-models'],
    queryFn: () => api.providers.getFreeModels().catch(() => [] as ModelInfo[]),
    retry: 1,
    staleTime: 300000,
    refetchInterval: 300000,
  });

  const { data: sessionsData } = useQuery({
    queryKey: ['sessions'],
    queryFn: api.chat.listSessions,
  });

  const createMutation = useMutation({
    mutationFn: () => api.chat.createSession(),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setActiveSession(session);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.chat.deleteSession(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      removeSession(id);
    },
  });

  useEffect(() => {
    if (sessionsData) setSessions(sessionsData);
  }, [sessionsData]);

  useEffect(() => {
    if (chatMode) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [chatMode]);

  useEffect(() => {
    if (activeSession) {
      loadMessages(activeSession.id);
    }
  }, [activeSession?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = async () => {
    let trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setLastError(null);

    if (webSearch) trimmed = `[Search web for] ${trimmed}`;
    if (reasoning) trimmed = `[Think step by step] ${trimmed}`;

    let session = activeSession;

    if (!chatMode) {
      setChatMode(true);
      if (!session) {
        try {
          session = await api.chat.createSession();
          queryClient.invalidateQueries({ queryKey: ['sessions'] });
          setActiveSession(session);
        } catch (err: any) {
          setLastError('Failed to create session: ' + (err.message || 'unknown error'));
          return;
        }
      }
    }

    if (!session) return;
    if (!isConnected) {
      setLastError('Not connected to server. Check your connection.');
      return;
    }

    let useModel = selectedModel;
    let useProvider = selectedProvider;

    if (autoMode) {
      useModel = 'openrouter/auto';
      useProvider = 'openrouter';
    }

    sendMessage(trimmed, useProvider, useModel, session.id);
    setInput('');
    setWebSearch(false);
    setReasoning(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const createNewSession = async () => {
    try {
      const session = await api.chat.createSession();
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setActiveSession(session);
      if (!chatMode) setChatMode(true);
    } catch (err: any) {
      setLastError('Failed to create session: ' + (err.message || 'unknown error'));
    }
  };

  return (
    <div className="flex-1 flex relative bg-oled min-h-0">
      <Starfield />

      {/* Sidebar */}
      <div className={`absolute lg:relative z-20 h-full transition-all duration-300 ${
        showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      } lg:w-56`}>
        <div className="w-56 h-full bg-black/60 backdrop-blur-2xl border-r border-white/[0.04] flex flex-col">
          <div className="p-3 border-b border-white/[0.04]">
            <button
              onClick={createNewSession}
              className="w-full flex items-center gap-2 justify-center text-sm py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/[0.06] transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              New Chat
            </button>
          </div>
          <div className="flex items-center gap-2 px-3 py-2">
            <History className="w-3 h-3 text-gray-600" />
            <span className="text-[9px] font-medium text-gray-600 uppercase tracking-widest">History</span>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => {
                    setActiveSession(session);
                    loadMessages(session.id);
                    if (!chatMode) setChatMode(true);
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-left transition-all group ${
                    activeSession?.id === session.id
                      ? 'bg-white/[0.06] text-gray-200'
                      : 'text-gray-600 hover:text-gray-400 hover:bg-white/[0.03]'
                  }`}
                >
                  <MessageSquare className="w-3 h-3 shrink-0" />
                  <span className="truncate flex-1">{session.title}</span>
                  <span
                    onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(session.id); }}
                    className="opacity-60 lg:opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-500/10 hover:text-red-400 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </span>
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col relative z-10 min-h-0">
          {/* Landing Mode */}
        {!chatMode && (
          <div className="flex-1 flex flex-col items-center justify-start pt-[15vh] px-4">
            {/* History toggle */}
            <div className="absolute top-4 left-4">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/5 text-gray-500 transition-all"
                title="History"
              >
                <History className="w-4 h-4" />
              </button>
            </div>

            {/* ASTRACHAT Logo */}
            <div className="mb-4 text-center">
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-thin tracking-[0.3em] text-white/70">
                ASTRACHAT
              </h1>

              {/* Connection status */}
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500/50 animate-pulse' : 'bg-red-500/50'}`} />
                <span className={`text-[10px] font-mono ${isConnected ? 'text-gray-600' : 'text-red-500/60'}`}>
                  {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                </span>
              </div>
            </div>

            {/* Error banner */}
            {lastError && (
              <div className="w-full max-w-lg mb-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-red-950/30 border border-red-500/10">
                <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                <span className="text-[11px] text-red-400/80 font-mono flex-1">{lastError}</span>
                <button onClick={() => setLastError(null)} className="text-red-400/60 hover:text-red-400 text-xs">✕</button>
              </div>
            )}

            {/* Model pill */}
            <div className="mt-4 mb-2">
              <ModelSelector
                selectedModel={selectedModel}
                selectedProvider={selectedProvider}
                onSelect={(model, provider) => {
                  setSelectedModel(model);
                  setSelectedProvider(provider);
                  useModelStore.getState().addRecent(model);
                  useModelStore.getState().setLastChanged(model, provider);
                  setTimeout(() => useModelStore.getState().setLastChanged(null, null), 4000);
                }}
              />
            </div>

            {/* Model change notice in landing */}
            {lastChangedModel && (
              <div className="w-full max-w-lg mb-3 flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/5 border border-accent/10">
                <RefreshCw className="w-3 h-3 text-accent-light shrink-0" />
                <span className="text-[10px] text-accent-light/80 font-mono">
                  Model changed to {lastChangedModel.split('/').pop()}
                </span>
              </div>
            )}

            {/* Input — glass tube */}
            <div className="w-full max-w-lg">
              <div
                className="relative flex flex-col items-center"
                style={{
                  borderRadius: '60px 60px 28px 28px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderTop: '1.5px solid rgba(255,255,255,0.25)',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 60%, transparent 100%)',
                  boxShadow: '0 0 60px rgba(255,255,255,0.04), inset 0 0 40px rgba(255,255,255,0.02)',
                }}
              >
                <div
                  className="absolute -top-[2px] left-1/2 -translate-x-1/2 w-4 h-[3px] rounded-full"
                  style={{ background: 'rgba(255,255,255,0.2)' }}
                />
                <div className="flex items-center gap-1.5 mt-2">
                  <button
                    onClick={() => setWebSearch(!webSearch)}
                    className={`flex items-center gap-1 px-3 py-2 sm:px-2.5 sm:py-1 rounded-md text-[11px] sm:text-[10px] font-medium transition-all ${
                      webSearch
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.15)]'
                        : 'text-gray-600 hover:text-gray-400 border border-white/[0.04] hover:border-white/10'
                    }`}
                  >
                    <Globe className="w-3 h-3" />
                    Search
                  </button>
                  <button
                    onClick={() => setReasoning(!reasoning)}
                    className={`flex items-center gap-1 px-3 py-2 sm:px-2.5 sm:py-1 rounded-md text-[11px] sm:text-[10px] font-medium transition-all ${
                      reasoning
                        ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.15)]'
                        : 'text-gray-600 hover:text-gray-400 border border-white/[0.04] hover:border-white/10'
                    }`}
                  >
                    <Brain className="w-3 h-3" />
                    Reason
                  </button>
                </div>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  rows={1}
                  className="w-full bg-transparent text-sm text-gray-200 placeholder-gray-600 resize-none outline-none max-h-[120px] leading-relaxed px-5 sm:px-8 pt-4 sm:pt-5 pb-2 text-center"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="pb-3 text-gray-500 hover:text-gray-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chat Mode */}
        {chatMode && (
          <div className="flex-1 flex flex-col animate-expand-chat min-h-0">
            {/* Top bar */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.04]">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="lg:hidden p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/5 text-gray-500"
              >
                <MessageSquare className="w-4 h-4" />
              </button>

              <ModelSelector
                selectedModel={selectedModel}
                selectedProvider={selectedProvider}
                onSelect={(model, provider) => {
                  setSelectedModel(model);
                  setSelectedProvider(provider);
                }}
              />

              <div className="flex-1" />

              {activeSession && (
                <span className="text-[10px] text-gray-700 font-mono">
                  {activeSession.messages?.length || messages.length} messages
                </span>
              )}

              <button
                onClick={createNewSession}
                className="p-2 sm:p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/5 text-gray-500 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Model change notice */}
            {lastChangedModel && (
              <div className="flex items-center gap-2 px-4 py-2 bg-accent/5 border-b border-accent/10">
                <RefreshCw className="w-3 h-3 text-accent-light shrink-0" />
                <span className="text-[10px] text-accent-light/80 font-mono">
                  Model changed to {lastChangedModel.split('/').pop()}
                </span>
              </div>
            )}

            {/* Connection status bar */}
            {!isConnected && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-950/30 border-b border-red-500/10">
                <WifiOff className="w-3 h-3 text-red-400" />
                <span className="text-[11px] text-red-400/80 font-mono">Disconnected from server</span>
              </div>
            )}

            {/* Error banner */}
            {lastError && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-950/30 border-b border-red-500/10">
                <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                <span className="text-[11px] text-red-400/80 font-mono flex-1">{lastError}</span>
                <button onClick={() => setLastError(null)} className="text-red-400/60 hover:text-red-400 text-xs">✕</button>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto scrollbar-custom">
              <div className="max-w-3xl mx-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] mb-4">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500/50 animate-pulse" />
                      <span className="text-[10px] text-gray-600 font-mono">MODEL ACTIVE</span>
                    </div>
                    <p className="text-xs text-gray-700 font-mono tracking-wider">
                      Send a message to begin
                    </p>
                  </div>
                )}

                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}

                {isStreaming && (
                  <ChatMessage
                    message={{
                      id: 'streaming',
                      sessionId: activeSession?.id || '',
                      role: 'assistant',
                      content: streamingContent || '',
                      createdAt: new Date().toISOString(),
                    }}
                    isStreaming
                    loading={!streamingContent}
                  />
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Chat Input */}
            <div className="px-4 pb-4 pt-2">
              <div className="max-w-3xl mx-auto">
                <div className="liquid-glass rounded-2xl px-4 py-3 flex items-end gap-2 transition-all duration-300 focus-within:border-white/[0.12]">
                  <div className="flex flex-col gap-2 flex-1">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setWebSearch(!webSearch)}
                        className={`flex items-center gap-1 px-3 py-2 sm:px-2 sm:py-0.5 rounded-md text-[11px] sm:text-[10px] font-medium transition-all ${
                          webSearch
                            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.15)]'
                            : 'text-gray-600 hover:text-gray-400 border border-white/[0.04] hover:border-white/10'
                        }`}
                      >
                        <Globe className="w-3 h-3" />
                        Search
                      </button>
                      <button
                        onClick={() => setReasoning(!reasoning)}
                        className={`flex items-center gap-1 px-3 py-2 sm:px-2 sm:py-0.5 rounded-md text-[11px] sm:text-[10px] font-medium transition-all ${
                          reasoning
                            ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.15)]'
                            : 'text-gray-600 hover:text-gray-400 border border-white/[0.04] hover:border-white/10'
                        }`}
                      >
                        <Brain className="w-3 h-3" />
                        Reason
                      </button>
                    </div>
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={isStreaming ? '...' : 'Type a message...'}
                      rows={1}
                      disabled={isStreaming}
                      className="w-full bg-transparent text-sm text-gray-200 placeholder-gray-700 resize-none outline-none max-h-[120px] disabled:opacity-30"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isStreaming && (
                      <span className="flex gap-0.5">
                        <span className="w-1 h-1 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1 h-1 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1 h-1 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    )}
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || isStreaming}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/[0.06] text-gray-400 hover:text-gray-200 transition-all disabled:opacity-20 disabled:cursor-not-allowed hover:scale-105 active:scale-95 shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
