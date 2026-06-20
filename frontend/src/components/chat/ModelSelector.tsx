import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, ChevronDown, Search, Star, Zap, Cpu, Globe, Brain, Layers, Heart, Settings, Gauge, Target } from 'lucide-react';
import { api } from '../../lib/api';
import { ModelInfo } from '../../types';
import { useModelStore } from '../../stores/modelStore';
import ModelModal from './ModelModal';
import CommandPalette from './CommandPalette';
import ComparePanel from './ComparePanel';

interface Props {
  selectedModel: string;
  selectedProvider: string;
  onSelect: (model: string, provider: string) => void;
}

const providerIcons: Record<string, typeof Zap> = {
  openrouter: Globe,
  openai: Cpu,
  anthropic: Brain,
  google: Layers,
};

const providerColors: Record<string, string> = {
  openrouter: '#FF6B35',
  openai: '#00A67E',
  anthropic: '#D4A574',
  google: '#4285F4',
};

const fallbackModels: ModelInfo[] = [
  { id: 'openrouter/auto', name: 'Auto (best model)', provider: 'openrouter', isFree: false },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash', provider: 'openrouter', isFree: true, contextLength: 1_048_576 },
  { id: 'deepseek/deepseek-chat-v3-0324:free', name: 'DeepSeek V3', provider: 'openrouter', isFree: true, contextLength: 131_072 },
  { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B', provider: 'openrouter', isFree: true, contextLength: 131_072 },
  { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen 2.5 72B', provider: 'openrouter', isFree: true, contextLength: 131_072 },
];

export default function ModelSelector({ selectedModel, selectedProvider, onSelect }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    favorites, isFavorite, addRecent, toggleFavorite, autoMode, setAutoMode,
    showModal, setShowModal, showPalette, setShowPalette, showCompare, setShowCompare,
  } = useModelStore();

  const { data: apiModels } = useQuery({
    queryKey: ['free-models'],
    queryFn: () => api.providers.getFreeModels().catch(() => []),
    retry: 1,
    staleTime: 60000,
  });

  const allModels: ModelInfo[] = (apiModels && apiModels.length > 0) ? apiModels : fallbackModels;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowPalette(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const selectedName = allModels.find((m) => m.id === selectedModel)?.name || selectedModel.split('/').pop() || selectedModel;
  const selectedIsFree = allModels.find((m) => m.id === selectedModel)?.isFree ?? true;

  const favoritesList = allModels.filter((m) => favorites.includes(m.id));
  const freeModelsList = allModels.filter((m) => m.isFree && !favorites.includes(m.id));
  const apiModelsList = allModels.filter((m) => !m.isFree && !favorites.includes(m.id));

  const filteredFavorites = search
    ? favoritesList.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()) || m.id.toLowerCase().includes(search.toLowerCase()))
    : favoritesList;

  const filteredFree = search
    ? freeModelsList.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()) || m.id.toLowerCase().includes(search.toLowerCase()))
    : freeModelsList;

  const filteredApi = search
    ? apiModelsList.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()) || m.id.toLowerCase().includes(search.toLowerCase()))
    : apiModelsList;

  const handleSelect = (model: ModelInfo) => {
    onSelect(model.id, model.provider);
    addRecent(model.id);
    useModelStore.getState().setLastChanged(model.id, model.provider);
    setIsOpen(false);
    setTimeout(() => useModelStore.getState().setLastChanged(null, null), 4000);
  };

  const renderModelItem = (model: ModelInfo) => {
    const Icon = providerIcons[model.provider] || Zap;
    const color = providerColors[model.provider] || '#6366f1';
    const isSel = selectedModel === model.id;
    const fav = favorites.includes(model.id);

    return (
      <button
        key={model.id}
        onClick={() => handleSelect(model)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
          isSel
            ? 'bg-white/[0.06] border border-white/10'
            : 'hover:bg-white/[0.03] border border-transparent'
        }`}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border"
          style={{ backgroundColor: color + '12', borderColor: color + '20' }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-medium truncate ${isSel ? 'text-gray-100' : 'text-gray-300'}`}>
              {model.name}
            </span>
            {model.isFree ? (
              <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400/70 font-medium shrink-0 tracking-wider border border-green-500/15">
                FREE
              </span>
            ) : (
              <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400/70 font-medium shrink-0 tracking-wider border border-amber-500/15">
                API
              </span>
            )}
          </div>
          <div className="text-[8px] text-gray-700 font-mono truncate mt-0.5">{model.id}</div>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); toggleFavorite(model.id); }}
          className={`p-1 rounded-lg transition-all shrink-0 ${
            fav ? 'text-yellow-400' : 'text-gray-700 opacity-0 group-hover:opacity-100 hover:text-yellow-400'
          }`}
        >
          <Star className="w-3 h-3" fill={fav ? 'currentColor' : 'none'} />
        </button>
      </button>
    );
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3 py-2 sm:py-1.5 min-h-[44px] rounded-xl text-xs transition-all border ${
            isOpen ? 'border-white/20 bg-white/[0.04]' : 'border-white/[0.06] hover:border-white/20'
          } text-gray-400 hover:text-gray-200 bg-white/[0.03] group`}
        >
          {autoMode ? (
            <Sparkles className="w-3.5 h-3.5 text-accent-light animate-pulse" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-yellow-400/70" />
          )}
          <span className="font-medium truncate max-w-[130px]">{selectedName}</span>
          {!autoMode && selectedIsFree && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400/80 font-medium tracking-wider leading-none">FREE</span>
          )}
          {autoMode && (
            <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent-light/70 font-medium tracking-wider leading-none">AI</span>
          )}
          <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-1.5 w-[calc(100vw-2rem)] sm:w-80 max-w-[calc(100vw-2rem)] bg-black/90 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl z-50 overflow-hidden">
            <div className="p-3 border-b border-white/[0.06]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search models..."
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-9 pr-3 py-2 text-xs text-gray-200 placeholder-gray-700 focus:outline-none focus:border-white/20 transition-all"
                />
              </div>

              <div className="flex items-center gap-1.5 mt-2.5">
                <button
                  onClick={() => setAutoMode(!autoMode)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-medium transition-all border ${
                    autoMode
                      ? 'bg-accent/10 text-accent-light border-accent/20'
                      : 'bg-white/[0.02] text-gray-600 border-white/[0.04] hover:text-gray-400'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  AUTO
                </button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto p-1 space-y-1">
              {filteredFavorites.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5">
                    <Star className="w-2.5 h-2.5 text-yellow-500/60" />
                    <span className="text-[9px] text-gray-700 font-mono tracking-wider uppercase">Favorites</span>
                  </div>
                  {filteredFavorites.map(renderModelItem)}
                </div>
              )}

              {filteredFree.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5">
                    <Sparkles className="w-2.5 h-2.5 text-green-500/60" />
                    <span className="text-[9px] text-gray-700 font-mono tracking-wider uppercase">Free</span>
                  </div>
                  {filteredFree.map(renderModelItem)}
                </div>
              )}

              {filteredApi.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5">
                    <Settings className="w-2.5 h-2.5 text-amber-500/60" />
                    <span className="text-[9px] text-gray-700 font-mono tracking-wider uppercase">By API Key</span>
                  </div>
                  {filteredApi.map(renderModelItem)}
                </div>
              )}

              {filteredFavorites.length === 0 && filteredFree.length === 0 && filteredApi.length === 0 && (
                <div className="text-center py-8 text-gray-600 text-xs">No models found</div>
              )}
            </div>

            <div className="p-2 border-t border-white/[0.04] space-y-0.5">
              <button
                onClick={() => { setIsOpen(false); setShowModal(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] text-gray-600 hover:text-gray-400 hover:bg-white/[0.03] transition-all"
              >
                <Settings className="w-3 h-3" />
                All models and settings →
              </button>
              <div className="flex items-center justify-between px-3 py-1">
                <span className="text-[7px] text-gray-800 font-mono">
                  {allModels.length} available models
                </span>
                <kbd className="text-[8px] text-gray-800 font-mono px-1 py-0.5 rounded bg-white/[0.02] border border-white/[0.04]">
                  ⌘K
                </kbd>
              </div>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <ModelModal
          selectedModel={selectedModel}
          selectedProvider={selectedProvider}
          onSelect={(model, provider) => {
            onSelect(model, provider);
            addRecent(model);
            useModelStore.getState().setLastChanged(model, provider);
            setTimeout(() => useModelStore.getState().setLastChanged(null, null), 4000);
          }}
          onClose={() => setShowModal(false)}
        />
      )}

      {showPalette && (
        <CommandPalette
          selectedModel={selectedModel}
          onSelect={(model, provider) => {
            onSelect(model, provider);
            addRecent(model);
            useModelStore.getState().setLastChanged(model, provider);
            setTimeout(() => useModelStore.getState().setLastChanged(null, null), 4000);
          }}
          onClose={() => setShowPalette(false)}
        />
      )}

      {showCompare && (
        <ComparePanel
          selectedModel={selectedModel}
          selectedProvider={selectedProvider}
          onSelect={(model, provider) => {
            onSelect(model, provider);
            addRecent(model);
            useModelStore.getState().setLastChanged(model, provider);
            setTimeout(() => useModelStore.getState().setLastChanged(null, null), 4000);
          }}
          onClose={() => setShowCompare(false)}
        />
      )}
    </>
  );
}
