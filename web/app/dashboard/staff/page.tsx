'use client';

import React, { useState } from 'react';
import {
  useGetUsersQuery,
  useCreateUserMutation,
  useDeleteUserMutation,
} from '@/lib/services/userApi';
import { UserRole } from '@/lib/features/auth/authSlice';
import { Search, Trash2, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

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
  const [newRole, setNewRole] = useState<UserRole>('admin');
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

  const adminsCount = users ? users.filter((u) => u.role === 'admin').length : 0;
  const scientistsCount = users ? users.filter((u) => u.role === 'scientist').length : 0;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Sep 10, 2026';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-sans">
      {/* Header with Title & Add button */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#E8EAED]">
            Staff directory
          </h1>
          <p className="text-xs text-[#8B92A0] mt-1">
            Admins and scientists with access to the ChandraSetu pipeline
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setFormSuccess(null);
            setIsModalOpen(true);
          }}
          className="px-3.5 py-1.5 rounded-md bg-[#12151C] border border-[#232833] hover:border-[#5B8DEF] text-[#5B8DEF] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>+ Add staff member</span>
        </button>
      </div>

      {/* Search Input & Segmented Filters Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-[#4E5462] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name or email"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-md bg-[#12151C] border border-[#232833] text-xs text-[#E8EAED] placeholder:text-[#4E5462] focus:outline-none focus:border-[#5B8DEF] transition-colors"
          />
        </div>

        {/* Filter Segmented Control */}
        <div className="flex items-center rounded-md bg-[#12151C] border border-[#232833] p-0.5 text-xs font-mono">
          <button
            type="button"
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
              roleFilter === 'all'
                ? 'bg-[#161A22] text-[#E8EAED] font-semibold'
                : 'text-[#8B92A0] hover:text-[#E8EAED]'
            }`}
          >
            All ({users?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('admin')}
            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
              roleFilter === 'admin'
                ? 'bg-[#161A22] text-[#E8EAED] font-semibold'
                : 'text-[#8B92A0] hover:text-[#E8EAED]'
            }`}
          >
            Admins ({adminsCount})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('scientist')}
            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
              roleFilter === 'scientist'
                ? 'bg-[#161A22] text-[#E8EAED] font-semibold'
                : 'text-[#8B92A0] hover:text-[#E8EAED]'
            }`}
          >
            Scientists ({scientistsCount})
          </button>
        </div>
      </div>

      {/* Staff Table */}
      <div className="rounded-xl bg-[#12151C] border border-[#232833] overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 text-[#5B8DEF] animate-spin" />
            <p className="text-xs font-mono text-[#8B92A0]">Loading personnel registry...</p>
          </div>
        ) : error ? (
          <div className="p-8 flex items-center justify-center gap-3 text-[#D9534F]">
            <AlertCircle className="w-5 h-5" />
            <p className="text-xs font-mono">Failed to fetch staff directory from gateway.</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-[#4E5462] font-mono text-xs">
            No staff records matching your filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#232833] text-[10px] font-mono text-[#4E5462] uppercase tracking-wider">
                  <th className="py-3.5 px-5 font-semibold">PERSONNEL</th>
                  <th className="py-3.5 px-5 font-semibold">ROLE</th>
                  <th className="py-3.5 px-5 font-semibold">ACCESS</th>
                  <th className="py-3.5 px-5 font-semibold">ADDED</th>
                  <th className="py-3.5 px-5 text-right font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232833] text-xs">
                {filteredUsers.map((person) => {
                  const isAdmin = person.role === 'admin';
                  const initials = person.name.substring(0, 2).toUpperCase();

                  return (
                    <tr key={person.userId} className="hover:bg-[#161A22]/50 transition-colors">
                      {/* Personnel */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-[#161A22] border border-[#232833] text-[#8B92A0] font-mono font-medium text-xs flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-[#E8EAED]">{person.name}</div>
                            <div className="text-[11px] text-[#8B92A0] font-mono">{person.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2 text-xs text-[#8B92A0]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#5B8DEF] inline-block" />
                          <span className="capitalize">{person.role}</span>
                        </div>
                      </td>

                      {/* Access */}
                      <td className="py-4 px-5">
                        <div>
                          <div className="text-xs text-[#E8EAED]">
                            {isAdmin ? 'Full access' : 'Science access'}
                          </div>
                          <div className="text-[10px] text-[#4E5462] font-mono">
                            {isAdmin ? 'upload · review · manage staff' : 'upload · review · run pipeline'}
                          </div>
                        </div>
                      </td>

                      {/* Added */}
                      <td className="py-4 px-5 text-xs font-mono text-[#8B92A0]">
                        {formatDate(person.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(person.userId, person.name)}
                          disabled={isDeleting}
                          className="w-7 h-7 rounded border border-[#232833] hover:border-[#D9534F]/40 hover:bg-[#161A22] text-[#4E5462] hover:text-[#D9534F] inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                          title="Revoke staff clearance"
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

      {/* Add Staff Member Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md rounded-xl bg-[#12151C] border border-[#232833] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[#232833] flex items-center justify-between bg-[#0A0C10]">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#E8EAED]">
                Register New Staff Member
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-6 h-6 rounded bg-[#161A22] hover:bg-[#232833] text-[#8B92A0] hover:text-[#E8EAED] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-4 font-sans">
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
                <label className="text-xs font-medium text-[#8B92A0]">Full Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Sahid Ahmed"
                  required
                  className="w-full px-3 py-1.5 rounded-md bg-[#0A0C10] border border-[#232833] text-xs text-[#E8EAED] placeholder:text-[#4E5462] focus:outline-none focus:border-[#5B8DEF]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[#8B92A0]">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full px-3 py-1.5 rounded-md bg-[#0A0C10] border border-[#232833] text-xs text-[#E8EAED] placeholder:text-[#4E5462] focus:outline-none focus:border-[#5B8DEF] font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[#8B92A0]">Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full px-3 py-1.5 rounded-md bg-[#0A0C10] border border-[#232833] text-xs text-[#E8EAED] placeholder:text-[#4E5462] focus:outline-none focus:border-[#5B8DEF] font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[#8B92A0]">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-1.5 rounded-md bg-[#0A0C10] border border-[#232833] text-xs text-[#E8EAED] focus:outline-none focus:border-[#5B8DEF] font-mono cursor-pointer"
                >
                  <option value="admin">Admin (Full access)</option>
                  <option value="scientist">Scientist (Science access)</option>
                </select>
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
                  <span>Add staff member</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
