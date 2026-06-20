import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Search, Star, DollarSign, Zap, Cpu, Globe, Brain, Layers, Heart, Check, Sparkles, Info, Gauge, Target } from 'lucide-react';
import { api } from '../../lib/api';
import { ModelInfo } from '../../types';
import { useModelStore } from '../../stores/modelStore';

interface Props {
  selectedModel: string;
  selectedProvider: string;
  onSelect: (model: string, provider: string) => void;
  onClose: () => void;
}

const providerColors: Record<string, string> = {
  openrouter: '#FF6B35',
  openai: '#00A67E',
  anthropic: '#D4A574',
  google: '#4285F4',
};

const providerIcons: Record<string, typeof Zap> = {
  openrouter: Globe,
  openai: Cpu,
  anthropic: Brain,
  google: Layers,
};

function getSpecialization(id: string, name: string): string {
  const l = (id + ' ' + name).toLowerCase();
  if (l.includes('deepseek') || l.includes('reason') || l.includes('r1')) return 'Reasoning · Code';
  if (l.includes('code') || l.includes('coder')) return 'Code generation';
  if (l.includes('gemini') || l.includes('flash')) return 'Fast · General';
  if (l.includes('llama')) return 'General · Creative';
  if (l.includes('mistral')) return 'General · Instruction';
  if (l.includes('qwen') || l.includes('qwq')) return 'General · Multilingual';
  if (l.includes('phi')) return 'Code · Math';
  if (l.includes('dolphin')) return 'General · Uncensored';
  return 'General purpose';
}

function getSpeedRating(id: string, name: string): number {
  const l = (id + ' ' + name).toLowerCase();
  if (l.includes('flash') || l.includes('3b') || l.includes('7b') || l.includes('small') || l.includes('mini')) return 5;
  if (l.includes('8b') || l.includes('9b') || l.includes('11b') || l.includes('14b')) return 4;
  if (l.includes('24b') || l.includes('27b') || l.includes('32b') || l.includes('70b') || l.includes('72b')) return 3;
  if (l.includes('120b') || l.includes('180b') || l.includes('r1')) return 2;
  return 3;
}

function getQualityRating(id: string, name: string): number {
  const l = (id + ' ' + name).toLowerCase();
  if (l.includes('r1') || l.includes('deepseek') || l.includes('gpt') || l.includes('claude')) return 5;
  if (l.includes('70b') || l.includes('72b') || l.includes('120b') || l.includes('llama') || l.includes('qwen')) return 4;
  if (l.includes('flash') || l.includes('8b') || l.includes('9b') || l.includes('24b') || l.includes('27b')) return 3;
  if (l.includes('3b') || l.includes('7b') || l.includes('mini') || l.includes('small')) return 2;
  return 3;
}

const fallbackModels: ModelInfo[] = [
  { id: 'openrouter/auto', name: 'Auto (best model)', provider: 'openrouter', isFree: false },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash', provider: 'openrouter', isFree: true, contextLength: 1_048_576 },
  { id: 'deepseek/deepseek-chat-v3-0324:free', name: 'DeepSeek V3', provider: 'openrouter', isFree: true, contextLength: 131_072 },
  { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B', provider: 'openrouter', isFree: true, contextLength: 131_072 },
  { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen 2.5 72B', provider: 'openrouter', isFree: true, contextLength: 131_072 },
];

type FilterTab = 'all' | 'free' | 'api' | 'fast';

export default function ModelModal({ selectedModel, selectedProvider, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const { favorites, toggleFavorite, isFavorite } = useModelStore();

  const { data: apiModels } = useQuery({
    queryKey: ['free-models'],
    queryFn: () => api.providers.getFreeModels().catch(() => []),
    retry: 1,
    staleTime: 300000,
    refetchInterval: 300000,
  });

  const allModels: ModelInfo[] = (apiModels && apiModels.length > 0) ? apiModels : fallbackModels;

  const filtered = useMemo(() => {
    let list = allModels;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));
    }
    if (filterTab === 'free') list = list.filter((m) => m.isFree);
    if (filterTab === 'api') list = list.filter((m) => !m.isFree);
    if (filterTab === 'fast') {
      list = list.filter((m) => {
        const speed = getSpeedRating(m.id, m.name);
        return speed >= 4;
      });
    }
    return list;
  }, [allModels, search, filterTab]);

  const handleSelect = (model: ModelInfo) => {
    onSelect(model.id, model.provider);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[80vh] bg-black/90 backdrop-blur-2xl border border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-expand-chat">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent/20 to-purple-500/20 flex items-center justify-center border border-white/[0.06]">
              <Sparkles className="w-4 h-4 text-accent-light" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-200 tracking-wider">SELECT AI MODEL</h2>
              <p className="text-[9px] text-gray-700 font-mono tracking-wider">CHOOSE THE BEST MODEL FOR YOUR TASK</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 sm:p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-white/[0.04] space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models..."
              autoFocus
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-2xl pl-11 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:border-white/20 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto -mx-6 px-6">
            {(['all', 'free', 'api', 'fast'] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`flex items-center gap-1.5 px-3 py-2 sm:py-1.5 min-h-[44px] rounded-xl text-[11px] sm:text-[10px] font-medium transition-all border shrink-0 ${
                  filterTab === tab
                    ? tab === 'free' ? 'bg-green-500/10 text-green-400 border-green-500/20'
                      : tab === 'api' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : tab === 'fast' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      : 'bg-white/[0.06] text-gray-200 border-white/20'
                    : 'bg-white/[0.02] text-gray-600 border-white/[0.04] hover:text-gray-400 hover:bg-white/[0.03]'
                }`}
              >
                {tab === 'all' && <Zap className="w-3 h-3" />}
                {tab === 'free' && <DollarSign className="w-3 h-3" />}
                {tab === 'api' && <Key className="w-3 h-3" />}
                {tab === 'fast' && <Gauge className="w-3 h-3" />}
                {tab === 'all' ? 'All' : tab === 'free' ? 'Free' : tab === 'api' ? 'API' : 'Fast'}
              </button>
            ))}
            <div className="flex-1" />
            <span className="text-[9px] text-gray-700 font-mono">{filtered.length} models</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((model) => {
              const Icon = providerIcons[model.provider] || Zap;
              const color = providerColors[model.provider] || '#6366f1';
              const selected = selectedModel === model.id;
              const fav = isFavorite(model.id);
              const speed = getSpeedRating(model.id, model.name);
              const quality = getQualityRating(model.id, model.name);
              const spec = getSpecialization(model.id, model.name);

              return (
                <button
                  key={model.id}
                  onClick={() => handleSelect(model)}
                  className={`group relative text-left rounded-2xl p-4 transition-all duration-300 cursor-pointer border ${
                    selected
                      ? 'border-accent/40 bg-gradient-to-br from-accent/10 to-purple-500/8'
                      : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                  } hover:border-accent/30 hover:shadow-[0_0_24px_rgba(99,102,241,0.15)] hover:-translate-y-0.5`}
                >
                  {selected && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}

                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(model.id); }}
                    className={`absolute top-3 left-3 p-1.5 sm:p-1 rounded-lg transition-all ${
                      fav ? 'text-yellow-400' : 'text-gray-700 opacity-60 lg:opacity-0 group-hover:opacity-100 hover:text-yellow-400'
                    }`}
                  >
                    <Star className="w-3 h-3" fill={fav ? 'currentColor' : 'none'} />
                  </button>

                  <div className="flex items-center gap-2.5 mb-3 mt-1">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border"
                      style={{ backgroundColor: color + '15', borderColor: color + '25' }}
                    >
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-semibold truncate ${selected ? 'text-gray-100' : 'text-gray-300 group-hover:text-gray-200'}`}>
                          {model.name}
                        </span>
                        {model.isFree ? (
                          <span className="text-[8px] sm:text-[7px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400/70 font-medium shrink-0 tracking-wider border border-green-500/15">
                            FREE
                          </span>
                        ) : (
                          <span className="text-[8px] sm:text-[7px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400/70 font-medium shrink-0 tracking-wider border border-amber-500/15">
                            API
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-gray-600 font-mono truncate mt-0.5">{model.id}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-gray-600 mb-2">
                    <Target className="w-2.5 h-2.5 shrink-0 text-gray-700" />
                    <span className="truncate">{spec}</span>
                  </div>

                  {model.contextLength && (
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-600 mb-2">
                      <Info className="w-2.5 h-2.5 shrink-0 text-gray-700" />
                      <span>{(model.contextLength / 1000).toFixed(0)}K context</span>
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Gauge className="w-2.5 h-2.5 text-gray-700" />
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full ${
                              i <= speed ? 'bg-green-500/50' : 'bg-white/[0.04]'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-2.5 h-2.5 text-gray-700" />
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full ${
                              i <= quality ? 'bg-purple-500/50' : 'bg-white/[0.04]'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}

            {filtered.length === 0 && (
              <div className="col-span-full text-center py-16">
                <Search className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                <p className="text-xs text-gray-600 font-mono">No models found</p>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-white/[0.04] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { useModelStore.getState().setAutoMode(!useModelStore.getState().autoMode); }}
              className={`flex items-center gap-1.5 px-3 py-2 sm:py-1.5 min-h-[44px] rounded-xl text-[10px] font-medium transition-all border ${
                useModelStore.getState().autoMode
                  ? 'bg-accent/10 text-accent-light border-accent/20'
                  : 'bg-white/[0.02] text-gray-600 border-white/[0.04] hover:text-gray-400'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              AUTO
            </button>
            <span className="text-[9px] text-gray-700 font-mono max-w-[200px] truncate">
              {useModelStore.getState().autoMode ? 'Auto-selects best model for your task' : 'Manual model selection'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { useModelStore.getState().setShowCompare(true); onClose(); }}
              className="flex items-center gap-1.5 px-3 py-2 sm:py-1.5 min-h-[44px] rounded-xl text-[10px] font-medium border border-white/[0.06] text-gray-500 hover:text-gray-300 hover:bg-white/[0.03] transition-all"
            >
              <Layers className="w-3 h-3" />
              Compare
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Key({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}
