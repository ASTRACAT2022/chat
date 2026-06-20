import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Check, Send, Sparkles, Clock, Zap, Cpu, Globe, Brain, Layers } from 'lucide-react';
import { api } from '../../lib/api';
import { ModelInfo } from '../../types';
import { useModelStore } from '../../stores/modelStore';

interface Props {
  selectedModel: string;
  selectedProvider: string;
  onSelect: (model: string, provider: string) => void;
  onClose: () => void;
}

const providerIcons: Record<string, typeof Zap> = {
  openrouter: Globe, openai: Cpu, anthropic: Brain, google: Layers,
};

const providerColors: Record<string, string> = {
  openrouter: '#FF6B35', openai: '#00A67E', anthropic: '#D4A574', google: '#4285F4',
};

const fallbackModels: ModelInfo[] = [
  { id: 'openrouter/auto', name: 'Auto (best model)', provider: 'openrouter', isFree: false },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash', provider: 'openrouter', isFree: true, contextLength: 1_048_576 },
  { id: 'deepseek/deepseek-chat-v3-0324:free', name: 'DeepSeek V3', provider: 'openrouter', isFree: true, contextLength: 131_072 },
  { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B', provider: 'openrouter', isFree: true, contextLength: 131_072 },
  { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen 2.5 72B', provider: 'openrouter', isFree: true, contextLength: 131_072 },
];

export default function ComparePanel({ selectedModel, selectedProvider, onSelect, onClose }: Props) {
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { compareModels, setCompareModels } = useModelStore();

  const { data: apiModels } = useQuery({
    queryKey: ['free-models'],
    queryFn: () => api.providers.getFreeModels().catch(() => []),
    retry: 1,
    staleTime: 60000,
  });

  const allModels: ModelInfo[] = (apiModels && apiModels.length > 0) ? apiModels : fallbackModels;
  const freeModels = allModels.filter((m) => m.isFree);

  const selectedCompareModels = useMemo(
    () => allModels.filter((m) => compareModels.includes(m.id)),
    [allModels, compareModels],
  );

  const availableCompareModels = compareModels.length > 0
    ? selectedCompareModels
    : freeModels.slice(0, 3);

  const handleCompare = async () => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setAnswers({});
    const token = localStorage.getItem('token');

    for (const model of availableCompareModels) {
      try {
        const res = await fetch('/api/providers/chat/completion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ provider: 'openrouter', model: model.id, messages: [{ role: 'user', content: question }] }),
        });
        const data = await res.json();
        setAnswers((prev) => ({ ...prev, [model.id]: data.content || 'No response' }));
      } catch {
        setAnswers((prev) => ({ ...prev, [model.id]: 'Error' }));
      }
    }
    setLoading(false);
  };

  const toggleCompareModel = (modelId: string) => {
    const next = compareModels.includes(modelId)
      ? compareModels.filter((id) => id !== modelId)
      : compareModels.length < 3
        ? [...compareModels, modelId]
        : compareModels;
    setCompareModels(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-black/90 backdrop-blur-2xl border border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-expand-chat">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center border border-white/[0.06]">
              <Layers className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-200 tracking-wider">COMPARE MODELS</h2>
              <p className="text-[9px] text-gray-700 font-mono tracking-wider">ASK THE SAME QUESTION TO MULTIPLE MODELS</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-white/[0.04] space-y-3">
          <div className="flex gap-2">
            {freeModels.slice(0, 6).map((m) => {
              const selected = compareModels.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggleCompareModel(m.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-medium transition-all border ${
                    selected
                      ? 'bg-accent/10 text-accent-light border-accent/20'
                      : 'bg-white/[0.02] text-gray-600 border-white/[0.04] hover:text-gray-400'
                  }`}
                >
                  {selected && <Check className="w-2.5 h-2.5" />}
                  {m.name.split(' ').slice(0, 2).join(' ')}
                </button>
              );
            })}
          </div>

          <div className="flex gap-3">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCompare(); }}
              placeholder="Ask a question to compare responses..."
              className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-2xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:border-white/20 transition-all"
            />
            <button
              onClick={handleCompare}
              disabled={!question.trim() || loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 text-sm border border-white/[0.06] transition-all shrink-0"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Compare
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {availableCompareModels.map((model) => {
              const Icon = providerIcons[model.provider] || Zap;
              const color = providerColors[model.provider] || '#6366f1';
              const answer = answers[model.id];

              return (
                <div key={model.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden flex flex-col">
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.04]">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border"
                      style={{ backgroundColor: color + '15', borderColor: color + '25' }}>
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-gray-300 truncate">{model.name}</span>
                        {model.isFree && (
                          <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400/70 font-medium shrink-0">FREE</span>
                        )}
                      </div>
                      <div className="text-[8px] text-gray-700 font-mono truncate">{model.id}</div>
                    </div>
                    <button
                      onClick={() => { onSelect(model.id, model.provider); onClose(); }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium bg-white/5 hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-all shrink-0"
                    >
                      <Check className="w-2.5 h-2.5" />
                      Use
                    </button>
                  </div>

                  <div className="flex-1 p-4 min-h-[120px]">
                    {!answer ? (
                      <div className="flex items-center justify-center h-full">
                        {loading ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-5 h-5 border-2 border-gray-700 border-t-transparent rounded-full animate-spin" />
                            <span className="text-[10px] text-gray-700 font-mono">Thinking...</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-800 font-mono">Waiting for question...</span>
                        )}
                      </div>
                    ) : (
                      <pre className="text-[11px] text-gray-500 font-mono whitespace-pre-wrap leading-relaxed">{answer}</pre>
                    )}
                  </div>

                  {answer && (
                    <div className="px-4 py-2 border-t border-white/[0.04] flex items-center gap-2 text-[9px] text-gray-700">
                      <Clock className="w-2.5 h-2.5" />
                      <span>Completed</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
