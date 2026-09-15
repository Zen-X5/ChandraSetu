'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/lib/hooks/hooks';
import { logout, setUser, UserProfile } from '@/lib/features/auth/authSlice';
import { useGetMeQuery, useLogoutMutation } from '@/lib/services/authApi';
import { useGetUsersQuery } from '@/lib/services/userApi';
import { getSessionCookie } from '@/lib/utils/session.utils';
import MissionControlTour from './MissionControlTour';
import {
  Home,
  Users,
  FlaskConical,
  Database,
  Layers,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Orbit,
  Menu,
  X,
} from 'lucide-react';

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [logoutApi] = useLogoutMutation();
  const user = useAppSelector((state) => state.auth.user);
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: meData, error: meError, isLoading: isMeLoading } = useGetMeQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const { data: users } = useGetUsersQuery();

  useEffect(() => {
    setMounted(true);
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

  const staffCount = users ? users.length : 3;
  const scientistsCount = users ? users.filter((u) => u.role === 'scientist').length : 0;

  const NAV_ITEMS: SidebarItem[] = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Staff', href: '/dashboard/staff', icon: Users, badge: staffCount },
    { name: 'Scientists', href: '/dashboard/scientists', icon: FlaskConical, badge: scientistsCount },
    { name: 'Observations', href: '/dashboard/observations', icon: Database, badge: 120 },
    { name: 'Pipeline', href: '/dashboard/pipeline', icon: Layers, badge: 2 },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  if (!mounted || (isMeLoading && !user && !meData)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0A0C10] text-[#E8EAED] font-mono">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#12151C] border border-[#232833] flex items-center justify-center text-[#5B8DEF]">
            <Orbit className="w-5 h-5 animate-spin [animation-duration:3s]" />
          </div>
          <span className="text-xs text-[#8B92A0] font-mono tracking-widest uppercase">
            Synchronizing Mission Control...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0A0C10] text-[#E8EAED] font-sans select-none">
      {/* Desktop Sidebar (Hidden on Mobile < md) */}
      <aside
        className={`hidden md:flex h-full bg-[#12151C] border-r border-[#232833] flex-col justify-between shrink-0 z-30 transition-all duration-200 ease-in-out ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        <div>
          {/* Brand Header with Close/Open Toggle */}
          <div className="h-16 flex items-center justify-between px-3.5 border-b border-[#232833]">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded bg-[#161A22] border border-[#232833] flex items-center justify-center text-[#5B8DEF] font-mono font-bold text-xs shrink-0">
                CS
              </div>
              {!collapsed && (
                <div className="flex flex-col truncate">
                  <span className="font-bold text-xs tracking-wider text-[#E8EAED] font-sans truncate">
                    CHANDRASETU
                  </span>
                  <span className="text-[9px] text-[#4E5462] font-mono tracking-wider uppercase truncate">
                    MISSION CONTROL
                  </span>
                </div>
              )}
            </div>

            {/* Sidebar Collapse / Expand Toggle Button */}
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="w-6 h-6 rounded bg-[#161A22] border border-[#232833] hover:border-[#5B8DEF] text-[#8B92A0] hover:text-[#E8EAED] flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="py-4 space-y-0.5 px-2">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  data-tour={`nav-${item.name.toLowerCase()}`}
                  className={`relative flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium rounded-md transition-colors group cursor-pointer ${
                    isActive
                      ? 'text-[#E8EAED] bg-[#161A22] font-semibold'
                      : 'text-[#8B92A0] hover:text-[#E8EAED] hover:bg-[#161A22]/50'
                  } ${collapsed ? 'justify-center px-0' : 'justify-between'}`}
                  title={collapsed ? item.name : undefined}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#5B8DEF] rounded-r" />
                  )}

                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#5B8DEF]' : 'text-[#8B92A0] group-hover:text-[#E8EAED]'}`} />
                    {!collapsed && <span className="tracking-wide truncate">{item.name}</span>}
                  </div>

                  {!collapsed && item.badge !== undefined && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#161A22] border border-[#232833] text-[#8B92A0] font-mono shrink-0">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Info & Logout Footer */}
        <div className="p-3 border-t border-[#232833] bg-[#12151C]">
          <div className={`flex items-center ${collapsed ? 'justify-center flex-col gap-2' : 'justify-between'} px-1 py-1`}>
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-[#161A22] border border-[#232833] flex items-center justify-center font-bold text-[10px] text-[#E8EAED] shrink-0">
                {initials[0] || 'U'}
              </div>
              {!collapsed && (
                <div className="flex flex-col truncate">
                  <span className="text-xs font-medium text-[#E8EAED] truncate">{userDisplayName}</span>
                  <span className="text-[9px] font-mono text-[#4E5462] uppercase truncate">{userRole}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="p-1 rounded text-[#8B92A0] hover:text-[#D9534F] hover:bg-[#161A22] transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Navigation Drawer (< md) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Dark Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />

          {/* Slide-out Panel */}
          <div className="relative w-64 max-w-[80vw] bg-[#12151C] border-r border-[#232833] flex flex-col justify-between h-full z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            <div>
              <div className="h-16 flex items-center justify-between px-4 border-b border-[#232833]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-[#161A22] border border-[#232833] flex items-center justify-center text-[#5B8DEF] font-mono font-bold text-xs shrink-0">
                    CS
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-xs tracking-wider text-[#E8EAED] font-sans">
                      CHANDRASETU
                    </span>
                    <span className="text-[9px] text-[#4E5462] font-mono tracking-wider uppercase">
                      MISSION CONTROL
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="w-7 h-7 rounded bg-[#161A22] border border-[#232833] text-[#8B92A0] hover:text-[#E8EAED] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="py-4 space-y-1 px-3">
                {NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 text-xs font-medium rounded-md transition-colors ${
                        isActive
                          ? 'text-[#E8EAED] bg-[#161A22] font-semibold border-l-2 border-[#5B8DEF]'
                          : 'text-[#8B92A0] hover:text-[#E8EAED] hover:bg-[#161A22]/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-[#5B8DEF]' : 'text-[#8B92A0]'}`} />
                        <span>{item.name}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#161A22] border border-[#232833] text-[#8B92A0] font-mono">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="p-4 border-t border-[#232833] bg-[#12151C]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-8 h-8 rounded-full bg-[#161A22] border border-[#232833] flex items-center justify-center font-bold text-xs text-[#E8EAED] shrink-0">
                    {initials[0] || 'U'}
                  </div>
                  <div className="flex flex-col truncate">
                    <span className="text-xs font-medium text-[#E8EAED] truncate">{userDisplayName}</span>
                    <span className="text-[9px] font-mono text-[#4E5462] uppercase truncate">{userRole}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 rounded text-[#8B92A0] hover:text-[#D9534F] hover:bg-[#161A22] transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0A0C10]">
        {/* Top Header */}
        <header className="h-13 border-b border-[#232833] bg-[#12151C] flex items-center justify-between px-3 sm:px-6 shrink-0 z-20 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger button for mobile */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="md:hidden w-8 h-8 rounded bg-[#161A22] border border-[#232833] text-[#8B92A0] hover:text-[#E8EAED] flex items-center justify-center shrink-0 cursor-pointer"
              title="Open Navigation"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2 w-2 rounded-full bg-[#3FB68B] inline-block shrink-0 shadow-[0_0_6px_rgba(63,182,139,0.7)]" />
              <span className="text-[10px] sm:text-[11px] font-mono text-[#8B92A0] font-semibold tracking-wider uppercase truncate">
                CHANDRAYAAN-2 NETWORK
              </span>
            </div>

            <div className="shrink-0">
              <MissionControlTour />
            </div>
          </div>

          <div data-tour="header-payloads" className="hidden lg:flex items-center gap-6 text-[11px] font-mono tracking-wider shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[#8B92A0]">OHRC</span>
              <span className="text-[#3FB68B] font-bold">ACTIVE</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#8B92A0]">TMC-2</span>
              <span className="text-[#4E5462] font-bold">DISABLED</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#8B92A0]">IIRS</span>
              <span className="text-[#4E5462] font-bold">DISABLED</span>
            </div>
          </div>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0A0C10]">
          {children}
        </main>
      </div>
    </div>
  );
}
