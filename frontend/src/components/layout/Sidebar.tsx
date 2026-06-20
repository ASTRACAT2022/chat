import { NavLink, useNavigate } from 'react-router-dom';
import { MessageSquare, Settings, LogOut, Sparkles, Bot } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

const navItems = [
  { to: '/chat', icon: MessageSquare, label: 'Chat' },
  { to: '/agent', icon: Bot, label: 'Agent' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-14 lg:w-48 flex flex-col bg-black/80 backdrop-blur-2xl border-r border-white/[0.04]">
      <button
        onClick={() => window.location.href = '/chat'}
        className="p-3 flex items-center gap-2 border-b border-white/[0.04] w-full cursor-pointer"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent/30 to-purple-500/30 flex items-center justify-center shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-accent-light" />
        </div>
        <span className="hidden lg:block text-xs font-thin tracking-[0.3em] text-white/60">
          AC
        </span>
      </button>

      <nav className="flex-1 p-1.5 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-2.5 py-2 min-h-[44px] rounded-lg text-xs transition-all duration-150 ${
                isActive
                  ? 'bg-white/[0.06] text-accent-light'
                  : 'text-gray-600 hover:text-gray-400 hover:bg-white/[0.03]'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="hidden lg:block">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-1.5 border-t border-white/[0.04] space-y-0.5">
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1.5">
          <div className="w-5 h-5 rounded-lg bg-white/[0.06] flex items-center justify-center">
            <span className="text-[10px] font-bold text-gray-400">
              {user?.username?.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-[10px] text-gray-500 truncate">{user?.username}</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 w-full px-2.5 py-2 min-h-[44px] rounded-lg text-xs text-gray-600 hover:text-red-400 hover:bg-red-500/5 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className="hidden lg:block">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
