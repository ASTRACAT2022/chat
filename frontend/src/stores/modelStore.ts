import { create } from 'zustand';

const FAVORITES_KEY = 'astrachat_favorites';
const RECENT_KEY = 'astrachat_recent';
const AUTO_MODE_KEY = 'astrachat_autoMode';

function loadArray(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveArray(key: string, arr: string[]) {
  localStorage.setItem(key, JSON.stringify(arr));
}

interface ModelState {
  favorites: string[];
  recentModels: string[];
  autoMode: boolean;
  showCompare: boolean;
  compareModels: string[];
  showModal: boolean;
  showPalette: boolean;
  lastChangedModel: string | null;
  lastChangedProvider: string | null;

  toggleFavorite: (modelId: string) => void;
  isFavorite: (modelId: string) => boolean;
  addRecent: (modelId: string) => void;
  setAutoMode: (on: boolean) => void;
  setShowCompare: (show: boolean) => void;
  setCompareModels: (models: string[]) => void;
  setShowModal: (show: boolean) => void;
  setShowPalette: (show: boolean) => void;
  setLastChanged: (model: string | null, provider: string | null) => void;
}

export const useModelStore = create<ModelState>((set, get) => ({
  favorites: loadArray(FAVORITES_KEY),
  recentModels: loadArray(RECENT_KEY),
  autoMode: localStorage.getItem(AUTO_MODE_KEY) === 'true',
  showCompare: false,
  compareModels: [],
  showModal: false,
  showPalette: false,
  lastChangedModel: null,
  lastChangedProvider: null,

  toggleFavorite: (modelId: string) => {
    const favs = get().favorites;
    const next = favs.includes(modelId)
      ? favs.filter((id) => id !== modelId)
      : [...favs, modelId];
    saveArray(FAVORITES_KEY, next);
    set({ favorites: next });
  },

  isFavorite: (modelId: string) => get().favorites.includes(modelId),

  addRecent: (modelId: string) => {
    const recent = get().recentModels.filter((id) => id !== modelId);
    const next = [modelId, ...recent].slice(0, 3);
    saveArray(RECENT_KEY, next);
    set({ recentModels: next });
  },

  setAutoMode: (on) => { localStorage.setItem(AUTO_MODE_KEY, String(on)); set({ autoMode: on }); },
  setShowCompare: (show) => set({ showCompare: show }),
  setCompareModels: (models) => set({ compareModels: models }),
  setShowModal: (show) => set({ showModal: show }),
  setShowPalette: (show) => set({ showPalette: show }),
  setLastChanged: (model, provider) => set({ lastChangedModel: model, lastChangedProvider: provider }),
}));

export function detectTaskType(text: string): 'code' | 'reasoning' | 'creative' | 'quick' | 'general' {
  const lower = text.toLowerCase();
  if (
    /code|program|function|class|def |import |const |let |var |html|<div|fetch|api|endpoint|route|database|sql|query|algorithm|debug/i.test(lower)
  ) return 'code';
  if (
    /explain|reason|analyze|compare|contrast|why|how.*works|logic|proof|math|calculate|solve/i.test(lower)
  ) return 'reasoning';
  if (
    /write|story|poem|essay|article|blog|creative|describe|imagine|draft/i.test(lower)
  ) return 'creative';
  if (
    /quick|short|brief|fast|simple|summarize|tl;dr|tldr/i.test(lower)
  ) return 'quick';
  return 'general';
}

export function autoPickModel(taskType: string, models: { id: string; name: string; isFree: boolean }[]): string | null {
  const freeModels = models.filter((m) => m.isFree);
  if (freeModels.length === 0) return models[0]?.id || null;

  if (taskType === 'code') {
    const deepseek = freeModels.find((m) => m.id.includes('deepseek'));
    if (deepseek) return deepseek.id;
  }
  if (taskType === 'reasoning') {
    const deepseek = freeModels.find((m) => m.id.includes('deepseek'));
    if (deepseek) return deepseek.id;
  }
  if (taskType === 'creative') {
    const llama = freeModels.find((m) => m.id.includes('llama'));
    if (llama) return llama.id;
  }
  if (taskType === 'quick') {
    const gemini = freeModels.find((m) => m.id.includes('gemini'));
    if (gemini) return gemini.id;
  }

  return freeModels[0]?.id || models[0]?.id || null;
}
