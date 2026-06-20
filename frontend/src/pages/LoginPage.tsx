import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loading = useAuthStore((s) => s.loading);

  if (loading) return null;
  if (isAuthenticated) return <Navigate to="/chat" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const result = isRegister
        ? await api.auth.register(username, email, password)
        : await api.auth.login(email, password);
      setAuth(result.accessToken, result.user);
      navigate('/chat', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/20 to-purple-500/20 flex items-center justify-center mx-auto mb-4 border border-white/[0.06]">
            <Sparkles className="w-6 h-6 text-accent-light" />
          </div>
          <h1 className="text-xl font-thin tracking-[0.3em] text-white/70">ASTRACHAT</h1>
          <p className="text-[11px] text-gray-700 mt-1 font-mono tracking-wider">NEURAL INTERFACE v1.0</p>
        </div>

        <form onSubmit={handleSubmit} className="liquid-glass rounded-2xl p-5 space-y-4">
          {isRegister && (
            <div>
              <label className="block text-[10px] text-gray-600 mb-1.5 font-mono tracking-wider uppercase">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:border-accent/30 transition-all"
                placeholder="your-username"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] text-gray-600 mb-1.5 font-mono tracking-wider uppercase">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:border-accent/30 transition-all"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] text-gray-600 mb-1.5 font-mono tracking-wider uppercase">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:border-accent/30 transition-all"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="text-[11px] text-red-400/80 bg-red-400/5 border border-red-400/10 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium border border-white/[0.06] transition-all"
          >
            {isRegister ? 'Initialize Access' : 'Authenticate'}
          </button>

          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

          <p className="text-[10px] text-gray-700 text-center font-mono">
            {isRegister ? 'Existing user?' : 'New user?'}{' '}
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              className="text-accent-light/70 hover:text-accent-light transition-colors"
            >
              {isRegister ? 'Sign in' : 'Register'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
