'use client';

import React, { useState } from 'react';
import {
  useGetUsersQuery,
  useCreateUserMutation,
  useDeleteUserMutation,
} from '@/lib/services/userApi';
import { FlaskConical, Search, UserPlus, Trash2, X, Loader2, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';

export default function ScientistsDirectoryPage() {
  const { data: users, isLoading, error } = useGetUsersQuery();
  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const handleCreateScientist = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      setFormError('Please provide complete scientist credentials.');
      return;
    }

    try {
      await createUser({
        name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: 'scientist',
      }).unwrap();

      setFormSuccess(`Successfully registered ${newName} to Chandrayaan-2 Science Division.`);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setTimeout(() => {
        setIsModalOpen(false);
        setFormSuccess(null);
      }, 1000);
    } catch (err: unknown) {
      const errorObj = err as { data?: { message?: string }; error?: string };
      setFormError(errorObj?.data?.message || errorObj?.error || 'Failed to add scientist.');
    }
  };

  const handleDeleteScientist = async (userId: string, name: string) => {
    if (!window.confirm(`Revoke science pipeline clearance for Dr./Scientist ${name}?`)) {
      return;
    }
    try {
      await deleteUser(userId).unwrap();
    } catch (err: unknown) {
      const errorObj = err as { data?: { message?: string }; error?: string };
      alert(errorObj?.data?.message || 'Failed to remove scientist.');
    }
  };

  const scientists = (users || []).filter((u) => u.role === 'scientist');

  const filteredScientists = scientists.filter((person) => {
    return (
      person.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      person.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-white font-sans">
              Mission Scientists
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Chandrayaan-2 Lunar Surface Image Correspondence & Registration Research Staff
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setFormSuccess(null);
            setIsModalOpen(true);
          }}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all cursor-pointer active:scale-95 shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Scientist</span>
        </button>
      </div>

      <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800/90 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.6)]">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search scientist by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500/60 transition-colors font-mono"
          />
        </div>
        <div className="text-xs font-mono text-slate-400">
          Total Scientists: <span className="text-purple-300 font-bold">{scientists.length}</span>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-950/90 border border-slate-800/90 overflow-hidden shadow-[0_4px_25px_rgba(0,0,0,0.8)]">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            <p className="text-xs font-mono text-slate-400">Loading scientists database...</p>
          </div>
        ) : error ? (
          <div className="p-8 flex items-center justify-center gap-3 text-rose-400">
            <AlertCircle className="w-5 h-5" />
            <p className="text-xs font-mono">Failed to fetch scientists list.</p>
          </div>
        ) : filteredScientists.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs">
            {scientists.length === 0
              ? 'No scientists registered yet. Click "Add Scientist" above to register research personnel.'
              : 'No scientists matching search query.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/50 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Scientist Name</th>
                  <th className="py-3 px-4">Domain Focus</th>
                  <th className="py-3 px-4">Clearance</th>
                  <th className="py-3 px-4">Date Assigned</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/80 text-xs">
                {filteredScientists.map((person) => {
                  const initials = person.name.substring(0, 2).toUpperCase();

                  return (
                    <tr key={person.userId} className="hover:bg-slate-900/30 transition-colors group">

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 via-indigo-600 to-cyan-700 flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-md">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-200">{person.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{person.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-purple-950/80 border border-purple-500/40 text-purple-300">
                          <FlaskConical className="w-3 h-3" />
                          <span>Lunar Science Pipeline</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-cyan-300 text-[11px]">
                        Level 3 · Science Data Access
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                        {person.createdAt ? new Date(person.createdAt).toLocaleDateString() : 'Active Mission'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteScientist(person.userId, person.name)}
                          disabled={isDeleting}
                          className="p-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 border border-rose-500/30 hover:border-rose-400 text-rose-400 hover:text-rose-200 transition-all cursor-pointer disabled:opacity-50"
                          title="Revoke scientist clearance"
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
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-purple-500/40 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(168,85,247,0.3)] overflow-hidden animate-in zoom-in-95 duration-200">

            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white font-sans">
                  Register Mission Scientist
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

            <form onSubmit={handleCreateScientist} className="p-5 space-y-4">

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
                <label className="text-xs font-semibold text-slate-300">Scientist Full Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Dr. K. Sivan"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500/60 font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Scientist Email / Callsign</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="scientist@isro.gov.in"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500/60 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Initial Access Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500/60 font-mono"
                />
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
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:brightness-110 text-white text-xs font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(168,85,247,0.4)] cursor-pointer transition-all disabled:opacity-50"
                >
                  {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Grant Scientist Clearance</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
