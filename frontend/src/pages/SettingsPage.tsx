import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Key, Eye, EyeOff, Check, User as UserIcon, Sparkles, Shield } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

const providers = [
  { id: 'openrouter', name: 'OpenRouter', color: '#FF6B35', desc: 'Free & paid models' },
  { id: 'openai', name: 'OpenAI', color: '#00A67E', desc: 'GPT-4, GPT-3.5' },
  { id: 'anthropic', name: 'Anthropic', color: '#D4A574', desc: 'Claude 3 models' },
  { id: 'google', name: 'Google Gemini', color: '#4285F4', desc: 'Gemini models' },
];

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({});

  const saveMutation = useMutation({
    mutationFn: ({ provider, key }: { provider: string; key: string }) =>
      api.users.saveApiKey(provider, key),
    onSuccess: (_, variables) => {
      setSavedKeys((prev) => ({ ...prev, [variables.provider]: true }));
      setTimeout(() => setSavedKeys((prev) => ({ ...prev, [variables.provider]: false })), 2000);
    },
  });

  const handleSave = (provider: string) => {
    const key = apiKeys[provider];
    if (!key) return;
    saveMutation.mutate({ provider, key });
  };

  const toggleVisibility = (provider: string) => {
    setVisibleKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  return (
    <div className="flex-1 overflow-y-auto bg-black">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent/20 to-purple-500/20 flex items-center justify-center border border-white/[0.06]">
            <Sparkles className="w-4 h-4 text-accent-light" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-200 tracking-wider">Settings</h2>
            <p className="text-[10px] text-gray-600 font-mono tracking-wider">SYSTEM CONFIGURATION</p>
          </div>
        </div>

        <div className="liquid-glass rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/[0.04]">
            <Key className="w-3.5 h-3.5 text-amber-400/70" />
            <h3 className="text-xs font-semibold text-gray-300 tracking-wider uppercase">API Keys</h3>
          </div>

          <p className="text-[11px] text-gray-600 leading-relaxed font-mono">
            Encrypted at rest — AES-256. Only OpenRouter is required for free models.
          </p>

          <div className="space-y-2.5">
            {providers.map((provider) => {
              const isPending = saveMutation.isPending && saveMutation.variables?.provider === provider.id;
              const isSaved = savedKeys[provider.id];

              return (
                <div key={provider.id} className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: provider.color }} />
                    <span className="text-xs font-medium text-gray-300">{provider.name}</span>
                    <span className="text-[9px] text-gray-700 font-mono">{provider.desc}</span>
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={visibleKeys[provider.id] ? 'text' : 'password'}
                        value={apiKeys[provider.id] || ''}
                        onChange={(e) => setApiKeys((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                        className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 pr-9 text-xs text-gray-200 placeholder-gray-700 focus:outline-none focus:border-accent/30 transition-all"
                        placeholder={`${provider.name} API key...`}
                      />
                      <button
                        onClick={() => toggleVisibility(provider.id)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
                      >
                        {visibleKeys[provider.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                    </div>
                    <button
                      onClick={() => handleSave(provider.id)}
                      disabled={!apiKeys[provider.id] || isPending}
                      className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 border ${
                        isSaved
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : 'bg-white/5 text-gray-400 border-white/[0.06] hover:bg-white/10 hover:text-gray-200 disabled:opacity-20'
                      }`}
                    >
                      {isPending ? <span className="w-3 h-3 border border-white/30 border-t-transparent rounded-full animate-spin" />
                        : isSaved ? <Check className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                      {isSaved ? 'Saved' : 'Save'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="liquid-glass rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/[0.04]">
            <UserIcon className="w-3.5 h-3.5 text-accent-light/70" />
            <h3 className="text-xs font-semibold text-gray-300 tracking-wider uppercase">Account</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Username', value: user?.username },
              { label: 'Email', value: user?.email },
              { label: 'Role', value: user?.role, cap: true },
              { label: 'Joined', value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-' },
            ].map((item) => (
              <div key={item.label}>
                <span className="text-[9px] text-gray-700 font-mono tracking-wider uppercase">{item.label}</span>
                <p className={`text-sm mt-0.5 text-gray-300 ${item.cap ? 'capitalize' : ''}`}>{item.value}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-blue-500/5 border border-blue-500/10 px-3 py-2">
            <Shield className="w-3 h-3 text-blue-400/70 shrink-0" />
            <span className="text-[10px] text-blue-300/60 font-mono">ENCRYPTED CONNECTION</span>
          </div>
        </div>
      </div>
    </div>
  );
}
