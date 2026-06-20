import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Sparkles } from 'lucide-react';
import { api } from '../../lib/api';
import { useChatStore } from '../../stores/chatStore';
import { useChat } from '../../hooks/useChat';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

export default function ChatWindow() {
  const { sessionId } = useParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedModel, setSelectedModel] = useState('openrouter/auto');
  const [selectedProvider, setSelectedProvider] = useState('openrouter');
  const {
    activeSession,
    setActiveSession,
    messages,
    setMessages,
    isStreaming,
    streamingContent,
  } = useChatStore();
  const { sendMessage } = useChat();

  const { data: session } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => api.chat.getSession(sessionId!),
    enabled: !!sessionId,
  });

  useEffect(() => {
    if (session) {
      setActiveSession(session);
      setMessages(session.messages || []);
      if (session.model) {
        const parts = session.model.split('/');
        setSelectedModel(session.model);
        setSelectedProvider(parts[0] || 'openrouter');
      }
    }
  }, [session]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = (content: string, model: string, provider: string) => {
    sendMessage(content, provider || selectedProvider, model || selectedModel);
  };

  if (!activeSession) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 to-purple-500/20 flex items-center justify-center mx-auto mb-5 border border-accent/10">
            <Sparkles className="w-8 h-8 text-accent-light" />
          </div>
          <h2 className="text-lg font-medium text-gray-300 mb-1.5">Welcome to AI Hub</h2>
          <p className="text-sm text-gray-600 max-w-xs">
            Select a chat or create a new one to start using free AI models
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/10 to-purple-500/10 flex items-center justify-center mx-auto mb-4 border border-accent/5">
                <Sparkles className="w-6 h-6 text-accent-light/60" />
              </div>
              <h3 className="text-sm font-medium text-gray-400 mb-1">
                {activeSession.title}
              </h3>
              <p className="text-xs text-gray-600">
                Send a message to start the conversation
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {isStreaming && streamingContent && (
            <ChatMessage
              message={{
                id: 'streaming',
                sessionId: activeSession.id,
                role: 'assistant',
                content: streamingContent,
                createdAt: new Date().toISOString(),
              }}
              isStreaming
            />
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <ChatInput
        onSend={handleSend}
        selectedModel={selectedModel}
        selectedProvider={selectedProvider}
        onModelChange={(model, provider) => {
          setSelectedModel(model);
          setSelectedProvider(provider);
        }}
      />
    </div>
  );
}
