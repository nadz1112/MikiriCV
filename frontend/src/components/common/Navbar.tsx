import React from 'react';
import { NavLink } from 'react-router-dom';
import { Briefcase, Users, Sparkles, LayoutDashboard, FileCheck } from 'lucide-react';

export const Navbar: React.FC = () => {
  const navItems = [
    { to: '/', label: 'Bảng điều khiển', icon: LayoutDashboard },
    { to: '/jobs', label: 'Job Descriptions', icon: Briefcase },
    { to: '/candidates', label: 'Hồ sơ Ứng viên', icon: Users },
    { to: '/matching', label: 'AI Matching', icon: Sparkles },
  ];

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <NavLink to="/" className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-xl shadow-md shadow-blue-500/20">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                CVMikiri
              </span>
              <span className="hidden sm:inline-block text-xs text-slate-400 ml-2 font-medium px-2 py-0.5 bg-slate-100 rounded-full">
                AI Screening
              </span>
            </div>
          </NavLink>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};
