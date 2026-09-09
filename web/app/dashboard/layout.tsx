'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/lib/hooks/hooks';
import { logout, setUser, UserProfile } from '@/lib/features/auth/authSlice';
import { useGetMeQuery, useLogoutMutation } from '@/lib/services/authApi';
import { getSessionCookie } from '@/lib/utils/session.utils';
import { Home, Users, FlaskConical, Layers, Database, Settings, LogOut, ChevronLeft, ChevronRight, Shield, Sparkles, Orbit } from 'lucide-react';

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  disabled?: boolean;
}

const NAV_ITEMS: SidebarItem[] = [
  { name: 'Home', href: '/dashboard', icon: Home },
  { name: 'Staff', href: '/dashboard/staff', icon: Users, badge: 'All' },
  { name: 'Scientists', href: '/dashboard/scientists', icon: FlaskConical },
  { name: 'Image Pairs', href: '/dashboard/observations', icon: Database, disabled: true },
  { name: 'Pipeline', href: '/dashboard/pipeline', icon: Layers },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [logoutApi] = useLogoutMutation();
  const user = useAppSelector((state) => state.auth.user);
  const [collapsed, setCollapsed] = useState(false);
  const { data: meData, error: meError, isLoading: isMeLoading } = useGetMeQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  useEffect(() => {
    const token = getSessionCookie();
    if (!token) {
      dispatch(logout());
      router.replace('/auth/login');
      return;
    }

    if (meData) {
      const userProfile = 'user' in meData && meData.user ? meData.user : (meData as UserProfile);
      if (userProfile && userProfile.userId) {
        dispatch(setUser(userProfile));
      }
    } else if (meError) {
      dispatch(logout());
      router.replace('/auth/login');
    }
  }, [meData, meError, dispatch, router]);

  const handleLogout = async () => {
    try {
      await logoutApi().unwrap();
    } catch {
    } finally {
      dispatch(logout());
      router.push('/auth/login');
    }
  };

  const resolvedUser = user || ('user' in (meData || {}) && (meData as { user: UserProfile }).user ? (meData as { user: UserProfile }).user : (meData as UserProfile | undefined));
  const userDisplayName = resolvedUser?.name || (resolvedUser?.email ? resolvedUser.email.split('@')[0] : 'Mission Controller');
  const userRole = resolvedUser?.role || 'admin';
  const initials = userDisplayName.substring(0, 2).toUpperCase();

  if (isMeLoading && !user && !meData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-slate-100 font-mono">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
            <Orbit className="w-6 h-6 animate-spin [animation-duration:3s]" />
          </div>
          <span className="text-xs text-cyan-300 font-bold tracking-widest uppercase animate-pulse">
            Verifying Telecommand Clearance...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black text-slate-100 font-sans select-none">
      <aside
        className={`relative z-30 h-full bg-slate-950/95 border-r border-cyan-500/20 flex flex-col justify-between transition-all duration-300 ease-in-out shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.8)] backdrop-blur-xl ${collapsed ? 'w-20' : 'w-64'
          }`}
      >
        <div>
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-900">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="relative flex items-center justify-center w-9 h-9 shrink-0">
                <Image
                  src="/logo.png"
                  alt="ChandraSetu Logo"
                  width={36}
                  height={36}
                  priority
                  className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(6,182,212,0.6)]"
                />
              </div>
              {!collapsed && (
                <div className="flex flex-col truncate">
                  <span className="font-extrabold text-sm tracking-wider bg-gradient-to-r from-cyan-400 via-sky-200 to-amber-300 bg-clip-text text-transparent truncate">
                    CHANDRASETU
                  </span>
                  <span className="text-[9px] text-cyan-400/80 font-mono tracking-tight uppercase truncate">
                    Mission Control
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="w-7 h-7 rounded-md bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 text-slate-400 hover:text-cyan-300 flex items-center justify-center transition-all cursor-pointer"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          <nav className="p-3 space-y-1.5 overflow-y-auto max-h-[calc(100vh-12rem)] scrollbar-none">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              if (item.disabled) {
                return (
                  <div
                    key={item.name}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium text-slate-600 opacity-60 cursor-not-allowed ${collapsed ? 'justify-center' : ''
                      }`}
                    title={`${item.name} (Upcoming Module)`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span>{item.name}</span>}
                  </div>
                );
              }

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all group cursor-pointer ${isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 via-blue-600/15 to-transparent text-cyan-200 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                    } ${collapsed ? 'justify-center' : ''}`}
                  title={collapsed ? item.name : undefined}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                  )}
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-cyan-300'
                      }`}
                  />
                  {!collapsed && (
                    <span className="flex-1 truncate tracking-wide font-sans">{item.name}</span>
                  )}
                  {!collapsed && item.badge && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-mono font-bold">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-3 border-t border-slate-900 bg-slate-950/90">
          <div
            className={`flex items-center gap-3 p-2 rounded-xl bg-slate-900/60 border border-slate-800/80 ${collapsed ? 'justify-center' : 'justify-between'
              }`}
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-800 flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-[0_0_10px_rgba(6,182,212,0.4)]">
                {initials}
              </div>
              {!collapsed && (
                <div className="flex flex-col truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-200 truncate">{userDisplayName}</span>
                    <Shield className="w-3 h-3 text-amber-400 shrink-0" />
                  </div>
                  <span className="text-[9px] font-mono text-cyan-400/90 uppercase tracking-tight truncate">
                    {userRole}
                  </span>
                </div>
              )}
            </div>

            {!collapsed && (
              <button
                type="button"
                onClick={handleLogout}
                className="w-7 h-7 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 hover:border-rose-400 text-rose-300 flex items-center justify-center transition-all cursor-pointer shrink-0"
                title="Log Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-black">

        <header className="h-14 border-b border-cyan-500/20 bg-slate-950/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 relative z-20 shadow-[0_4px_20px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <span className="text-xs font-mono text-cyan-300 font-semibold tracking-wider uppercase">
              CHANDRAYAAN-2 NETWORK
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5 text-amber-300/90">
              <Sparkles className="w-3.5 h-3.5" />
              <span>OHRC · TMC-2 · IIRS</span>
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-black relative z-10 scrollbar-thin scrollbar-thumb-slate-800">
          {children}
        </main>
      </div>
    </div>
  );
}
