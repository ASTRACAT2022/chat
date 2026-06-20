import { X, GripVertical } from 'lucide-react';
import { ChainStep as ChainStepType } from '../../types';

interface Props {
  step: ChainStepType;
  index: number;
  onUpdate: (updates: Partial<ChainStepType>) => void;
  onRemove: () => void;
}

const providers = [
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'search', label: 'Web Search' },
] as const;

const tasks = [
  { value: 'reasoning', label: 'Reasoning' },
  { value: 'web_search', label: 'Web Search' },
  { value: 'final_write', label: 'Final Write' },
  { value: 'custom', label: 'Custom' },
] as const;

export default function ChainStep({ step, index, onUpdate, onRemove }: Props) {
  return (
    <div className="liquid-glass rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <GripVertical className="w-3.5 h-3.5 text-gray-600" />
        <span className="text-[10px] font-mono text-accent-light/70 font-semibold tracking-wider uppercase">
          Step {index + 1}
        </span>
        <button onClick={onRemove} className="ml-auto p-1 hover:text-red-400 transition-colors rounded hover:bg-red-500/5">
          <X className="w-3 h-3" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[9px] text-gray-600 mb-1 font-mono tracking-wider uppercase">Provider</label>
          <select
            value={step.provider}
            onChange={(e) => onUpdate({ provider: e.target.value as any })}
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-accent/30 transition-all"
          >
            {providers.map((p) => (
              <option key={p.value} value={p.value} className="bg-black">{p.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[9px] text-gray-600 mb-1 font-mono tracking-wider uppercase">Task</label>
          <select
            value={step.task}
            onChange={(e) => onUpdate({ task: e.target.value as any })}
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-accent/30 transition-all"
          >
            {tasks.map((t) => (
              <option key={t.value} value={t.value} className="bg-black">{t.label}</option>
            ))}
          </select>
        </div>

        {step.provider !== 'search' && (
          <div className="col-span-2">
            <label className="block text-[9px] text-gray-600 mb-1 font-mono tracking-wider uppercase">System Prompt</label>
            <textarea
              value={step.prompt || ''}
              onChange={(e) => onUpdate({ prompt: e.target.value })}
              placeholder="Optional system prompt..."
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-gray-300 placeholder-gray-700 resize-none focus:outline-none focus:border-accent/30 transition-all"
              rows={2}
            />
          </div>
        )}
      </div>
    </div>
  );
}
