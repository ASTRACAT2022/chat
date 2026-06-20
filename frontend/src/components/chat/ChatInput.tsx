import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Globe, Brain, Paperclip, StopCircle } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import ModelSelector from './ModelSelector';

interface Props {
  onSend: (message: string, model: string, provider: string) => void;
  onFileUpload?: (file: File) => void;
  selectedModel: string;
  selectedProvider: string;
  onModelChange: (model: string, provider: string) => void;
}

export default function ChatInput({ onSend, onFileUpload, selectedModel, selectedProvider, onModelChange }: Props) {
  const [input, setInput] = useState('');
  const [webSearch, setWebSearch] = useState(false);
  const [reasoning, setReasoning] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isStreaming, streamingContent } = useChatStore();

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    let message = trimmed;
    if (webSearch) message = `[Search web for] ${message}`;
    if (reasoning) message = `[Think step by step] ${message}`;

    onSend(message, selectedModel, selectedProvider);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) onFileUpload(file);
  };

  return (
    <div className="border-t border-deep-200/50 bg-gradient-to-t from-deep via-deep/95 to-transparent px-4 pt-3 pb-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-2.5 px-1">
          <div className="flex items-center gap-2">
            <ModelSelector
              selectedModel={selectedModel}
              selectedProvider={selectedProvider}
              onSelect={onModelChange}
            />
            <div className="w-px h-4 bg-deep-200" />
            <button
              onClick={() => setWebSearch(!webSearch)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                webSearch
                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.15)]'
                  : 'text-gray-500 hover:text-gray-300 border border-deep-200 hover:border-deep-300'
              }`}
            >
              <Globe className="w-3 h-3" />
              Search
            </button>
            <button
              onClick={() => setReasoning(!reasoning)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                reasoning
                  ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.15)]'
                  : 'text-gray-500 hover:text-gray-300 border border-deep-200 hover:border-deep-300'
              }`}
            >
              <Brain className="w-3 h-3" />
              Reason
            </button>
            {onFileUpload && (
              <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-gray-500 hover:text-gray-300 border border-deep-200 hover:border-deep-300 cursor-pointer transition-all">
                <Paperclip className="w-3 h-3" />
                File
                <input type="file" accept=".pdf,.txt" onChange={handleFileChange} className="hidden" />
              </label>
            )}
          </div>

          {isStreaming && (
            <div className="flex items-center gap-1.5 text-[11px] text-accent-light">
              <span className="relative flex w-2 h-2">
                <span className="animate-ping absolute inline-flex w-full h-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full w-2 h-2 bg-accent" />
              </span>
              Generating...
            </div>
          )}
        </div>

        <div className="flex items-end gap-2 bg-deep-50/80 backdrop-blur-sm border border-deep-200/60 rounded-xl px-4 py-2.5 focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/20 transition-all shadow-sm">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'Waiting for response...' : 'Type a message...'}
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-500 resize-none outline-none max-h-[160px] disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="btn-primary p-2 rounded-lg shrink-0 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
