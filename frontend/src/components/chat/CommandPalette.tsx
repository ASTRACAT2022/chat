import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Sparkles, Star, ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';
import { ModelInfo } from '../../types';
import { useModelStore } from '../../stores/modelStore';

interface Props {
  selectedModel: string;
  onSelect: (model: string, provider: string) => void;
  onClose: () => void;
}

const fallbackModels: ModelInfo[] = [
  { id: 'openrouter/auto', name: 'Auto (best model)', provider: 'openrouter', isFree: false },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash', provider: 'openrouter', isFree: true, contextLength: 1_048_576 },
  { id: 'deepseek/deepseek-chat-v3-0324:free', name: 'DeepSeek V3', provider: 'openrouter', isFree: true, contextLength: 131_072 },
  { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B', provider: 'openrouter', isFree: true, contextLength: 131_072 },
  { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen 2.5 72B', provider: 'openrouter', isFree: true, contextLength: 131_072 },
];

export default function CommandPalette({ selectedModel, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { favorites } = useModelStore();

  const { data: apiModels } = useQuery({
    queryKey: ['free-models'],
    queryFn: () => api.providers.getFreeModels().catch(() => []),
    retry: 1,
    staleTime: 60000,
  });

  const allModels: ModelInfo[] = (apiModels && apiModels.length > 0) ? apiModels : fallbackModels;

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return allModels.slice(0, 8);
    return allModels
      .filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
      .slice(0, 10);
  }, [allModels, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        onSelect(results[selectedIndex].id, results[selectedIndex].provider);
        onClose();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [results, selectedIndex, onSelect, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-black/90 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden animate-expand-chat">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
          <Search className="w-4 h-4 text-gray-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models..."
            className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-700 focus:outline-none"
          />
          <kbd className="text-[10px] text-gray-700 font-mono px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">ESC</kbd>
        </div>

        <div className="max-h-72 overflow-y-auto p-1.5 space-y-0.5">
          {!query && favorites.length > 0 && (
            <div className="px-3 py-1.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Star className="w-2.5 h-2.5 text-yellow-500/60" />
                <span className="text-[9px] text-gray-700 font-mono tracking-wider uppercase">Favorites</span>
              </div>
              {allModels
                .filter((m) => favorites.includes(m.id))
                .slice(0, 3)
                .map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { onSelect(m.id, m.provider); onClose(); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] text-left transition-colors"
                  >
                    <Sparkles className="w-3 h-3 text-yellow-500/40" />
                    <span className="text-xs text-gray-400">{m.name}</span>
                    {m.isFree && <span className="text-[8px] text-green-500/60 font-mono ml-auto">FREE</span>}
                  </button>
                ))}
              <div className="border-t border-white/[0.04] my-1.5" />
            </div>
          )}

          {results.map((m, i) => (
            <button
              key={m.id}
              onClick={() => { onSelect(m.id, m.provider); onClose(); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all ${
                i === selectedIndex
                  ? 'bg-white/[0.06] border border-white/10'
                  : 'hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              <div className="w-6 h-6 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                <Sparkles className="w-3 h-3 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-medium truncate ${selectedModel === m.id ? 'text-accent-light' : 'text-gray-300'}`}>
                    {m.name}
                  </span>
                  {m.isFree && (
                    <span className="text-[7px] px-1 py-0.5 rounded-full bg-green-500/10 text-green-400/70 font-medium shrink-0">FREE</span>
                  )}
                </div>
                <div className="text-[9px] text-gray-700 font-mono truncate">{m.id}</div>
              </div>
              {i === selectedIndex && <ArrowRight className="w-3 h-3 text-accent-light shrink-0" />}
            </button>
          ))}

          {results.length === 0 && (
            <div className="text-center py-8 text-gray-600 text-xs">No models found</div>
          )}
        </div>
      </div>
    </div>
  );
}
