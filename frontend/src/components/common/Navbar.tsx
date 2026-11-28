import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Briefcase, Users, Sparkles, LayoutDashboard, FileCheck, ChevronDown, KeyRound, LogOut, Shield, UserRound } from 'lucide-react';
import { useAuthStore } from '../../features/auth/authStore';
import { useSubscriptionStore } from '../../features/subscription/subscriptionStore';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const subscription = useSubscriptionStore((state) => state.subscription);
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  useEffect(() => { setOpen(false); }, [user?.id]);
  useEffect(() => {
    const outside = (e: PointerEvent) => { if (e.target instanceof Node && !menu.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  if (!user) return null;
  const admin = user.role === 'ADMIN';
  const navItems = admin
    ? [{ to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard }, { to: '/admin/companies', label: 'Quản lý doanh nghiệp', icon: Briefcase }, { to: '/admin/users', label: 'Quản lý tài khoản', icon: Shield }]
    : [{ to: '/', label: 'Bảng điều khiển', icon: LayoutDashboard }, { to: '/jobs', label: 'Quản lý JD', icon: Briefcase }, { to: '/candidates', label: 'Quản lý CV', icon: Users }, { to: '/matching', label: 'AI Matching Studio', icon: Sparkles }];
  const remaining = subscription?.remaining;
  const tokenColor = remaining !== undefined && remaining <= 0 ? 'border-red-200 bg-red-50 text-red-800'
    : remaining !== undefined && remaining <= (subscription?.tokenLimit ?? 0) * 0.2 ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-blue-200 bg-blue-50 text-blue-700';
  return <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
    <div className="mx-auto flex h-16 w-full max-w-[1920px] items-center justify-between gap-2 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-16">
      <NavLink to={admin ? '/admin/dashboard' : '/'} className="flex items-center gap-2"><span className="rounded-xl bg-blue-700 p-2 text-white"><FileCheck size={21}/></span><span className="text-xl font-bold text-blue-700">CVMikiri</span></NavLink>
      <nav className={`hidden items-center gap-1 ${admin ? 'md:flex' : 'lg:flex'}`}>{navItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}><Icon size={16}/>{label}</NavLink>)}</nav>
      <div className="flex items-center gap-2 sm:gap-3">
        {!admin && <Link to="/account?tab=plan" className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-semibold sm:px-3 sm:text-xs ${tokenColor}`}>
          {remaining === undefined ? 'Đang tải token…' : `Token còn ${remaining.toLocaleString('vi-VN')}`}
        </Link>}
        <div ref={menu} className="relative" onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); menu.current?.querySelector('button')?.focus(); } }}>
          <button aria-label="Mở menu người dùng" aria-expanded={open} aria-controls="user-menu" onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"><span className="grid h-9 w-9 place-items-center rounded-full bg-blue-100 font-bold text-blue-800">{user.fullName.slice(0, 1).toUpperCase()}</span><span className="hidden text-left sm:block"><span className="block max-w-36 truncate text-sm font-semibold">{user.fullName}</span><span className="block max-w-36 truncate text-xs text-slate-500">{user.companyName || 'Quản trị viên'}</span></span><ChevronDown size={16}/></button>
          {open && <div id="user-menu" className="absolute right-0 top-12 z-50 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
            {admin ? <button onClick={() => { setOpen(false); navigate('/change-password'); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"><KeyRound size={16}/>Đổi mật khẩu</button>
              : <Link to="/account" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"><UserRound size={16}/>Tài khoản của tôi</Link>}
            <button onClick={async () => { setOpen(false); await logout(); navigate('/login', { replace: true }); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"><LogOut size={16}/>Đăng xuất</button>
          </div>}
        </div>
      </div>
    </div>
    <nav className={`flex gap-1 overflow-x-auto px-3 pb-2 ${admin ? 'md:hidden' : 'lg:hidden'}`}>{navItems.map(({ to, label }) => <NavLink key={to} to={to} className={({ isActive }) => `whitespace-nowrap rounded px-2 py-1 text-xs ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600'}`}>{label}</NavLink>)}</nav>
  </header>;
};
