'use client';

import React, { useState } from 'react';
import {
  useGetUsersQuery,
  useCreateUserMutation,
  useDeleteUserMutation,
} from '@/lib/services/userApi';
import { UserRole } from '@/lib/features/auth/authSlice';
import { Search, UserPlus, Trash2, Shield, FlaskConical, X, Loader2, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';

export default function StaffDirectoryPage() {
  const { data: users, isLoading, error } = useGetUsersQuery();
  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'scientist'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('scientist');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      setFormError('Please fill in all required credentials.');
      return;
    }

    try {
      await createUser({
        name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
      }).unwrap();

      setFormSuccess(`Successfully registered ${newName} with ${newRole} clearance.`);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setTimeout(() => {
        setIsModalOpen(false);
        setFormSuccess(null);
      }, 1000);
    } catch (err: unknown) {
      const errorObj = err as { data?: { message?: string }; error?: string; message?: string };
      setFormError(errorObj?.data?.message || errorObj?.error || 'Failed to create user.');
    }
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to revoke clearance for ${name}?`)) {
      return;
    }
    try {
      await deleteUser(userId).unwrap();
    } catch (err: unknown) {
      const errorObj = err as { data?: { message?: string }; error?: string };
      alert(errorObj?.data?.message || 'Failed to delete user.');
    }
  };

  const filteredUsers = (users || []).filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-white font-sans">
              Staff Directory
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Complete registry of Chandrayaan-2 Mission Administrators & Research Scientists
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setFormSuccess(null);
            setIsModalOpen(true);
          }}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-700 hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all cursor-pointer active:scale-95 shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800/90 flex flex-col md:flex-row items-center justify-between gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.6)]">

        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60 transition-colors font-mono"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${roleFilter === 'all'
              ? 'bg-cyan-950 border border-cyan-500 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
          >
            All Staff ({users?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('admin')}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${roleFilter === 'admin'
              ? 'bg-amber-950 border border-amber-500 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
          >
            Admins ({users?.filter((u) => u.role === 'admin').length || 0})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('scientist')}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${roleFilter === 'scientist'
              ? 'bg-purple-950 border border-purple-500 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
          >
            Scientists ({users?.filter((u) => u.role === 'scientist').length || 0})
          </button>
        </div>

      </div>

      <div className="rounded-2xl bg-slate-950/90 border border-slate-800/90 overflow-hidden shadow-[0_4px_25px_rgba(0,0,0,0.8)]">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="text-xs font-mono text-slate-400">Loading personnel registry...</p>
          </div>
        ) : error ? (
          <div className="p-8 flex items-center justify-center gap-3 text-rose-400">
            <AlertCircle className="w-5 h-5" />
            <p className="text-xs font-mono">Failed to fetch staff directory from gateway.</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs">
            No staff records matching your filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/50 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Personnel</th>
                  <th className="py-3 px-4">Role & Clearance</th>
                  <th className="py-3 px-4">Access Level</th>
                  <th className="py-3 px-4">Registered Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/80 text-xs">
                {filteredUsers.map((person) => {
                  const isAdmin = person.role === 'admin';
                  const initials = person.name.substring(0, 2).toUpperCase();

                  return (
                    <tr key={person.userId} className="hover:bg-slate-900/30 transition-colors group">

                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-md ${isAdmin
                              ? 'bg-gradient-to-br from-amber-500 to-orange-700'
                              : 'bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-700'
                              }`}
                          >
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-200">{person.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{person.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${isAdmin
                            ? 'bg-amber-950/80 border-amber-500/50 text-amber-300'
                            : 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'
                            }`}
                        >
                          {isAdmin ? <Shield className="w-3 h-3" /> : <FlaskConical className="w-3 h-3" />}
                          <span>{person.role}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-300 text-[11px]">
                        {isAdmin ? (
                          <span className="text-amber-300 font-semibold">Level 5 · Full Telecommand</span>
                        ) : (
                          <span className="text-cyan-300">Level 3 · Science Pipeline</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                        {person.createdAt ? new Date(person.createdAt).toLocaleDateString() : 'Mission Seed'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(person.userId, person.name)}
                          disabled={isDeleting}
                          className="p-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 border border-rose-500/30 hover:border-rose-400 text-rose-400 hover:text-rose-200 transition-all cursor-pointer disabled:opacity-50"
                          title="Revoke clearance"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-cyan-500/40 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(6,182,212,0.3)] overflow-hidden animate-in zoom-in-95 duration-200">

            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white font-sans">
                  Register New Mission Staff
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-4">

              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-500/60 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Full Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Dr. Vikram Sarabhai"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60 font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Callsign / Official Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="vikram@isro.gov.in"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Security Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Clearance Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-cyan-500/60 font-mono cursor-pointer"
                >
                  <option value="scientist">Scientist (Research & Pipeline Access)</option>
                  <option value="admin">Administrator (Full Telecommand Clearance)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-pointer transition-all disabled:opacity-50"
                >
                  {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Grant Clearance</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
