'use client';

import React, { useState } from 'react';
import {
  useGetUsersQuery,
  useCreateUserMutation,
  useDeleteUserMutation,
} from '@/lib/services/userApi';
import { FlaskConical, Search, UserPlus, Trash2, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

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
    <div className="space-y-6 max-w-[1600px] mx-auto font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#E8EAED]">
            Mission Scientists
          </h1>
          <p className="text-xs text-[#8B92A0] font-mono mt-0.5">
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
          className="px-3.5 py-1.5 rounded-lg bg-[#161A22] border border-[#232833] hover:border-[#5B8DEF] text-[#5B8DEF] font-mono text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Add Scientist</span>
        </button>
      </div>

      <div className="p-3 rounded-xl bg-[#12151C] border border-[#232833] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-[#4E5462] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter scientists..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-md bg-[#0A0C10] border border-[#232833] text-xs text-[#E8EAED] placeholder:text-[#4E5462] focus:outline-none focus:border-[#5B8DEF] transition-colors font-mono"
          />
        </div>

        <div className="text-xs font-mono text-[#8B92A0]">
          Total Researchers: <span className="text-[#5B8DEF] font-bold">{scientists.length}</span>
        </div>
      </div>

      <div className="rounded-xl bg-[#12151C] border border-[#232833] overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 text-[#5B8DEF] animate-spin" />
            <p className="text-xs font-mono text-[#8B92A0]">Loading scientist records...</p>
          </div>
        ) : error ? (
          <div className="p-8 flex items-center justify-center gap-3 text-[#D9534F]">
            <AlertCircle className="w-5 h-5" />
            <p className="text-xs font-mono">Failed to fetch scientists.</p>
          </div>
        ) : filteredScientists.length === 0 ? (
          <div className="p-12 text-center text-[#4E5462] font-mono text-xs">
            No scientists currently registered. Add your first researcher.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#232833] text-[10px] font-mono text-[#4E5462] uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">Scientist</th>
                  <th className="py-3 px-4 font-semibold">Specialization</th>
                  <th className="py-3 px-4 font-semibold">Clearance</th>
                  <th className="py-3 px-4 font-semibold">Joined Date</th>
                  <th className="py-3 px-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232833] text-xs font-mono">
                {filteredScientists.map((person) => {
                  const initials = person.name.substring(0, 2).toUpperCase();

                  return (
                    <tr key={person.userId} className="hover:bg-[#161A22] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded bg-[#161A22] border border-[#232833] text-[#5B8DEF] flex items-center justify-center font-bold text-[11px] shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-sans font-medium text-[#E8EAED]">{person.name}</div>
                            <div className="text-[11px] text-[#8B92A0]">{person.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-[#8B92A0] font-sans text-xs">
                        Planetary Photogrammetry & DEM
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-[#161A22] border border-[#5B8DEF]/40 text-[#5B8DEF]">
                          <FlaskConical className="w-3 h-3" />
                          <span>Level 3 · Science</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-[#4E5462] text-[11px]">
                        {person.createdAt ? new Date(person.createdAt).toLocaleDateString() : 'Mission Baseline'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteScientist(person.userId, person.name)}
                          disabled={isDeleting}
                          className="p-1.5 rounded text-[#8B92A0] hover:text-[#D9534F] hover:bg-[#161A22] transition-colors cursor-pointer disabled:opacity-50"
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
          <div className="relative w-full max-w-md rounded-xl bg-[#12151C] border border-[#232833] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[#232833] flex items-center justify-between bg-[#0A0C10]">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#E8EAED]">
                Register New Scientist
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-6 h-6 rounded bg-[#161A22] hover:bg-[#232833] text-[#8B92A0] hover:text-[#E8EAED] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleCreateScientist} className="p-5 space-y-4 font-sans">
              {formError && (
                <div className="p-2.5 rounded-md bg-[#161A22] border border-[#D9534F]/50 text-[#D9534F] text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#D9534F] shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-2.5 rounded-md bg-[#161A22] border border-[#3FB68B]/50 text-[#3FB68B] text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#3FB68B] shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-[#8B92A0]">Scientist Full Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Dr. K. Sivan"
                  required
                  className="w-full px-3 py-1.5 rounded-md bg-[#0A0C10] border border-[#232833] text-xs text-[#E8EAED] placeholder:text-[#4E5462] focus:outline-none focus:border-[#5B8DEF]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[#8B92A0]">Official Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="sivan@isro.gov.in"
                  required
                  className="w-full px-3 py-1.5 rounded-md bg-[#0A0C10] border border-[#232833] text-xs text-[#E8EAED] placeholder:text-[#4E5462] focus:outline-none focus:border-[#5B8DEF] font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[#8B92A0]">Security Access Key</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full px-3 py-1.5 rounded-md bg-[#0A0C10] border border-[#232833] text-xs text-[#E8EAED] placeholder:text-[#4E5462] focus:outline-none focus:border-[#5B8DEF] font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 font-mono">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-md bg-[#0A0C10] hover:bg-[#161A22] text-[#8B92A0] text-xs cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-1.5 rounded-md bg-[#161A22] border border-[#5B8DEF]/50 hover:bg-[#232833] text-[#5B8DEF] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                >
                  {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Grant Science Access</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
