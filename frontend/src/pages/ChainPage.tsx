import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, GitBranch, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { useChainStore } from '../stores/chainStore';
import ChainStep from '../components/chain/ChainStep';

export default function ChainPage() {
  const queryClient = useQueryClient();
  const [chainName, setChainName] = useState('');
  const {
    chains, setChains, editingSteps,
    startEditing, addStep, removeStep, updateStep, clearEditing,
  } = useChainStore();

  const { data: chainsData } = useQuery({
    queryKey: ['chains'],
    queryFn: api.chain.list,
  });

  const createMutation = useMutation({
    mutationFn: () => api.chain.create(chainName || 'New Chain', editingSteps),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chains'] });
      clearEditing();
      setChainName('');
    },
  });

  useEffect(() => {
    if (chainsData) setChains(chainsData);
  }, [chainsData]);

  const handleSave = () => {
    if (editingSteps.length === 0) return;
    createMutation.mutate();
  };

  return (
    <div className="flex-1 flex bg-black">
      <div className="w-56 bg-black/60 backdrop-blur-2xl border-r border-white/[0.04] flex flex-col">
        <div className="p-3 border-b border-white/[0.04]">
          <button
            onClick={startEditing}
            className="w-full flex items-center gap-2 justify-center text-sm py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/[0.06] transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            New Chain
          </button>
        </div>

        <div className="flex items-center gap-2 px-3 py-2">
          <GitBranch className="w-3 h-3 text-gray-600" />
          <span className="text-[9px] font-medium text-gray-600 uppercase tracking-widest">Chains</span>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {chains.map((chain) => (
            <button
              key={chain.id}
              onClick={() => useChainStore.getState().editChain(chain)}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-gray-600 hover:text-gray-400 hover:bg-white/[0.03] text-left transition-colors"
            >
              <GitBranch className="w-3 h-3 shrink-0" />
              <span className="truncate">{chain.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          {editingSteps.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/10 to-purple-500/10 flex items-center justify-center mx-auto mb-4 border border-white/[0.06]">
                <GitBranch className="w-6 h-6 text-gray-500" />
              </div>
              <h2 className="text-sm font-bold text-gray-400 tracking-wider mb-1">Chain Builder</h2>
              <p className="text-[11px] text-gray-700 font-mono mb-6">MULTI-MODEL PROCESSING PIPELINES</p>
              <button onClick={startEditing} className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm border border-white/[0.06] transition-all">
                Create Chain
              </button>
            </div>
          ) : (
            <div className="space-y-4 animate-expand-chat">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent/20 to-purple-500/20 flex items-center justify-center border border-white/[0.06]">
                  <GitBranch className="w-4 h-4 text-accent-light" />
                </div>
                <input
                  type="text"
                  value={chainName}
                  onChange={(e) => setChainName(e.target.value)}
                  placeholder="Chain name..."
                  className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:border-accent/30 transition-all"
                />
                <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm border border-white/[0.06] transition-all">
                  <Save className="w-3.5 h-3.5" />
                  Save
                </button>
              </div>

              <div className="space-y-3">
                {editingSteps.map((step, i) => (
                  <ChainStep
                    key={step.id}
                    step={step}
                    index={i}
                    onUpdate={(updates) => updateStep(step.id, updates)}
                    onRemove={() => removeStep(step.id)}
                  />
                ))}
              </div>

              <button
                onClick={() => addStep()}
                className="w-full flex items-center gap-2 justify-center py-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] text-gray-600 hover:text-gray-400 text-xs border border-dashed border-white/[0.06] transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Step
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
