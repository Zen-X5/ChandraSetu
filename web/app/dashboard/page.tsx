'use client';

import React from 'react';
import Link from 'next/link';
import { useGetUsersQuery } from '@/lib/services/userApi';
import { Users, FlaskConical, ShieldCheck, ArrowUpRight } from 'lucide-react';

export default function DashboardHomePage() {
  const { data: users, isLoading } = useGetUsersQuery();

  const totalStaffCount = users ? users.length : 1;
  const scientistsCount = users ? users.filter((u) => u.role === 'scientist').length : 0;
  const adminsCount = users ? users.filter((u) => u.role === 'admin').length : 1;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">

      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-extrabold tracking-tight text-white font-sans">
            Mission Control Home
          </h1>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono font-bold text-slate-400 tracking-wider uppercase flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            ADMIN OVERVIEW
          </h2>
          <Link
            href="/dashboard/staff"
            className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>Manage All Personnel</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          <Link
            href="/dashboard/staff"
            className="relative p-5 rounded-2xl bg-slate-950/90 border border-slate-800/90 hover:border-cyan-500/50 shadow-[0_4px_20px_rgba(0,0,0,0.7)] transition-all duration-200 group overflow-hidden block"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 to-cyan-600 rounded-t-2xl" />
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-medium text-slate-400">Total staff</span>
                <div className="text-2xl font-black text-white mt-1 font-mono tracking-tight">
                  {isLoading ? '...' : totalStaffCount}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-300 group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/scientists"
            className="relative p-5 rounded-2xl bg-slate-950/90 border border-slate-800/90 hover:border-purple-500/50 shadow-[0_4px_20px_rgba(0,0,0,0.7)] transition-all duration-200 group overflow-hidden block"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-400 to-indigo-600 rounded-t-2xl" />
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-medium text-slate-400">Mission scientists</span>
                <div className="text-2xl font-black text-white mt-1 font-mono tracking-tight">
                  {isLoading ? '...' : scientistsCount}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-950/70 border border-purple-500/30 flex items-center justify-center text-purple-300 group-hover:scale-110 transition-transform">
                <FlaskConical className="w-5 h-5" />
              </div>
            </div>
          </Link>

          <div className="relative p-5 rounded-2xl bg-slate-950/90 border border-slate-800/90 shadow-[0_4px_20px_rgba(0,0,0,0.7)] overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-orange-600 rounded-t-2xl" />
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-medium text-slate-400">Admin controllers</span>
                <div className="text-2xl font-black text-white mt-1 font-mono tracking-tight">
                  {isLoading ? '...' : adminsCount}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-950/70 border border-amber-500/30 flex items-center justify-center text-amber-300">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
