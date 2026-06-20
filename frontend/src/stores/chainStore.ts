import { create } from 'zustand';
import { Chain, ChainStep } from '../types';

function generateId(): string {
  return crypto.randomUUID?.() || Math.random().toString(36).slice(2);
}

interface ChainState {
  chains: Chain[];
  editingChain: Chain | null;
  editingSteps: ChainStep[];

  setChains: (chains: Chain[]) => void;
  addChain: (chain: Chain) => void;
  startEditing: () => void;
  editChain: (chain: Chain) => void;
  setEditingSteps: (steps: ChainStep[]) => void;
  addStep: (step?: Partial<ChainStep>) => void;
  removeStep: (stepId: string) => void;
  updateStep: (stepId: string, updates: Partial<ChainStep>) => void;
  clearEditing: () => void;
}

export const useChainStore = create<ChainState>((set) => ({
  chains: [],
  editingChain: null,
  editingSteps: [],

  setChains: (chains) => set({ chains }),
  addChain: (chain) => set((state) => ({ chains: [...state.chains, chain] })),

  startEditing: () =>
    set({
      editingChain: null,
      editingSteps: [
        {
          id: generateId(),
          provider: 'openrouter',
          task: 'reasoning',
        },
      ],
    }),

  editChain: (chain) =>
    set({
      editingChain: chain,
      editingSteps: chain.steps,
    }),

  setEditingSteps: (steps) => set({ editingSteps: steps }),

  addStep: (step) =>
    set((state) => ({
      editingSteps: [
        ...state.editingSteps,
        {
          id: generateId(),
          provider: 'openrouter',
          task: 'custom',
          ...step,
        },
      ],
    })),

  removeStep: (stepId) =>
    set((state) => ({
      editingSteps: state.editingSteps.filter((s) => s.id !== stepId),
    })),

  updateStep: (stepId, updates) =>
    set((state) => ({
      editingSteps: state.editingSteps.map((s) =>
        s.id === stepId ? { ...s, ...updates } : s,
      ),
    })),

  clearEditing: () => set({ editingChain: null, editingSteps: [] }),
}));
