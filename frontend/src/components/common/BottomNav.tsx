import React from 'react';
import { NavLink } from 'react-router-dom';
import { Briefcase, Building2, LayoutDashboard, Shield, Sparkles, UserRound, Users } from 'lucide-react';
import { useSafeAuth } from '../../features/auth/useSafeAuth';

export const BottomNav: React.FC = () => {
  const { user } = useSafeAuth();
  if (!user || user.mustChangePassword) return null;

  const items =
    user.role === 'ADMIN'
      ? [
          { to: '/admin/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
          { to: '/admin/companies', label: 'Doanh nghiệp', icon: Building2 },
          { to: '/admin/users', label: 'Tài khoản', icon: Shield },
        ]
      : [
          { to: '/', label: 'Tổng quan', icon: LayoutDashboard },
          { to: '/jobs', label: 'JD', icon: Briefcase },
          { to: '/candidates', label: 'CV', icon: Users },
          { to: '/matching', label: 'AI Studio', icon: Sparkles },
          { to: '/account', label: 'Tài khoản', icon: UserRound },
        ];

  return (
    <nav
      aria-label="Điều hướng di động"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 py-1">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/' || to === '/admin/dashboard'}
            className={({ isActive }) =>
              `flex min-h-[48px] min-w-[54px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1 text-[11px] font-semibold transition ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-800'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
