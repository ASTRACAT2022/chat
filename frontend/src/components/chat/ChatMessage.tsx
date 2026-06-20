import { User, Bot } from 'lucide-react';
import { ChatMessage as ChatMessageType } from '../../types';
import MarkdownRenderer from './MarkdownRenderer';

interface Props {
  message: ChatMessageType;
  isStreaming?: boolean;
  loading?: boolean;
}

const modelColors: Record<string, string> = {
  openrouter: '#FF6B35',
  openai: '#00A67E',
  anthropic: '#D4A574',
  google: '#4285F4',
};

function getProviderFromModel(model?: string): string {
  if (!model) return 'unknown';
  if (model.includes('gemini')) return 'google';
  if (model.includes('claude')) return 'anthropic';
  if (model.includes('gpt')) return 'openai';
  if (model.includes('/')) return model.split('/')[0];
  return 'unknown';
}

export default function ChatMessage({ message, isStreaming, loading }: Props) {
  const isUser = message.role === 'user';
  const provider = getProviderFromModel(message.model);
  const accentColor = modelColors[provider] || '#6366f1';

  return (
    <div className={`flex gap-3 animate-fade-in ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border"
        style={{
          backgroundColor: isUser ? 'rgba(99,102,241,0.08)' : `${accentColor}10`,
          borderColor: isUser ? 'rgba(99,102,241,0.12)' : `${accentColor}15`,
        }}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5" style={{ color: '#818cf8' }} />
        ) : (
          <Bot className="w-3.5 h-3.5" style={{ color: accentColor }} />
        )}
      </div>

      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-white/[0.04] border border-white/[0.06]'
            : 'bg-white/[0.02] border border-white/[0.04]'
        }`}
      >
        {message.model && !isUser && (
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded-md tracking-wider"
              style={{
                backgroundColor: `${accentColor}12`,
                color: accentColor,
              }}
            >
              {message.model}
            </span>
          </div>
        )}
        <div className="text-sm leading-relaxed text-gray-300">
          {loading ? (
            <span className="flex items-center gap-1.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent/40 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-accent/40 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-accent/40 animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
          {isStreaming && !loading && (
            <span className="inline-flex ml-0.5 gap-0.5">
              <span className="w-[2px] h-3.5 bg-accent/70 rounded-full animate-pulse" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
