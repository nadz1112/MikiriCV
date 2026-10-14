import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Briefcase, Users, Sparkles, LayoutDashboard, FileCheck, ChevronDown, KeyRound, LogOut, Shield } from 'lucide-react';
import { useAuthStore } from '../../features/auth/authStore';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuthStore(); const [open, setOpen] = useState(false); const navigate = useNavigate();
  if (!user) return null;
  const navItems = user.role === 'ADMIN'
    ? [{ to: '/admin/users', label: 'Quản lý tài khoản', icon: Shield }]
    : [{ to: '/', label: 'Bảng điều khiển', icon: LayoutDashboard }, { to: '/jobs', label: 'Job Descriptions', icon: Briefcase }, { to: '/candidates', label: 'Quản lý CV', icon: Users }, { to: '/matching', label: 'AI Matching Studio', icon: Sparkles }];
  return <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"><NavLink to={user.role === 'ADMIN' ? '/admin/users' : '/'} className="flex items-center gap-2"><span className="rounded-xl bg-blue-700 p-2 text-white"><FileCheck size={21}/></span><span className="text-xl font-bold text-blue-700">CVMikiri</span></NavLink>
      <nav className="hidden items-center gap-1 md:flex">{navItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}><Icon size={16}/>{label}</NavLink>)}</nav>
      <div className="relative"><button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"><span className="grid h-9 w-9 place-items-center rounded-full bg-blue-100 font-bold text-blue-800">{user.fullName.slice(0,1).toUpperCase()}</span><span className="hidden text-left sm:block"><span className="block max-w-36 truncate text-sm font-semibold">{user.fullName}</span><span className="block max-w-36 truncate text-xs text-slate-500">{user.companyName || 'Quản trị viên'}</span></span><ChevronDown size={16}/></button>
        {open && <div className="absolute right-0 top-12 z-50 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-xl"><button onClick={() => { setOpen(false); navigate('/change-password'); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"><KeyRound size={16}/>Đổi mật khẩu</button><button onClick={async () => { setOpen(false); await logout(); navigate('/login', { replace: true }); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"><LogOut size={16}/>Đăng xuất</button></div>}</div>
    </div>
    <nav className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden">{navItems.map(({to,label}) => <NavLink key={to} to={to} className={({isActive}) => `whitespace-nowrap rounded px-2 py-1 text-xs ${isActive?'bg-blue-50 text-blue-700':'text-slate-600'}`}>{label}</NavLink>)}</nav>
  </header>;
};
