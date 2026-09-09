'use client';

import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/lib/hooks/hooks';
import { useGetMeQuery } from '@/lib/services/authApi';
import { useResetPasswordMutation, useUpdateProfileMutation } from '@/lib/services/userApi';
import { UserProfile, setUser } from '@/lib/features/auth/authSlice';
import { KeyRound, ShieldCheck, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, Edit3, X, Lock, UserCheck, Orbit } from 'lucide-react';

export default function SettingsPage() {
  const dispatch = useAppDispatch();
  const reduxUser = useAppSelector((state) => state.auth.user);
  const { data: meData, isLoading: isMeLoading } = useGetMeQuery();

  const user: UserProfile | undefined =
    reduxUser ||
    (meData
      ? 'user' in meData && meData.user
        ? (meData.user as UserProfile)
        : (meData as UserProfile)
      : undefined);

  const [resetPassword, { isLoading: isResettingPassword }] = useResetPasswordMutation();
  const [updateProfile, { isLoading: isUpdatingProfile }] = useUpdateProfileMutation();

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [editName, setEditName] = useState('');
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess(null);
    setProfileError(null);

    if (!user) {
      setProfileError('User session expired. Please log in again.');
      return;
    }

    if (!editName.trim()) {
      setProfileError('Name cannot be empty.');
      return;
    }

    try {
      const updatedUser = await updateProfile({
        userId: user.userId,
        name: editName.trim(),
      }).unwrap();

      dispatch(setUser(updatedUser));
      setProfileSuccess('Profile name updated successfully.');
      setTimeout(() => {
        setIsEditModalOpen(false);
        setProfileSuccess(null);
      }, 1000);
    } catch (err: unknown) {
      const errorObj = err as { data?: { message?: string }; error?: string };
      setProfileError(errorObj?.data?.message || errorObj?.error || 'Failed to update profile.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess(null);
    setPasswordError(null);

    if (!user) {
      setPasswordError('User session expired. Please log in again.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    try {
      const res = await resetPassword({
        userId: user.userId,
        currentPassword: currentPassword.trim() || undefined,
        newPassword: newPassword.trim(),
      }).unwrap();

      setPasswordSuccess(res.message || 'Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsResetModalOpen(false);
        setPasswordSuccess(null);
      }, 1500);
    } catch (err: unknown) {
      const errorObj = err as { data?: { message?: string }; error?: string };
      setPasswordError(
        errorObj?.data?.message || errorObj?.error || 'Failed to update password. Verify current credentials.',
      );
    }
  };

  const userDisplayName = user?.name || (user?.email ? user.email.split('@')[0] : 'Mission Personnel');
  const userEmail = user?.email || 'N/A';
  const userRole = user?.role || 'scientist';
  const isAdmin = userRole === 'admin';
  const initials = userDisplayName.substring(0, 2).toUpperCase();

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  if (!user && isMeLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-3">
          <Orbit className="w-8 h-8 text-cyan-400 animate-spin [animation-duration:3s]" />
          <span className="text-xs text-slate-400 font-bold uppercase tracking-widest animate-pulse">
            Loading Account Details...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white font-sans">
            Account Settings
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Manage your authenticated user profile and account credentials
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setPasswordError(null);
              setPasswordSuccess(null);
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
              setIsResetModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-amber-300 font-mono font-bold text-xs flex items-center gap-2 border border-slate-700 hover:border-amber-500/50 shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>Reset Password</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setProfileError(null);
              setProfileSuccess(null);
              setEditName(userDisplayName);
              setIsEditModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-cyan-300 font-mono font-bold text-xs flex items-center gap-2 border border-slate-700 hover:border-cyan-500/50 shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-950/90 border border-slate-800/90 shadow-[0_4px_25px_rgba(0,0,0,0.8)] overflow-hidden p-6 sm:p-8 space-y-8">

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-6 border-b border-slate-900">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center font-black text-2xl text-white shrink-0 shadow-[0_0_20px_rgba(0,0,0,0.8)] border-2 ${isAdmin
              ? 'bg-gradient-to-br from-amber-500 to-orange-700 border-amber-400/50 shadow-amber-900/30'
              : 'bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-700 border-cyan-400/50 shadow-cyan-900/30'
              }`}
          >
            {initials}
          </div>

          <div className="space-y-1.5 text-center sm:text-left flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">{userDisplayName}</h2>
                <p className="text-xs text-slate-400 font-mono">{userEmail}</p>
              </div>

              <div className="flex items-center justify-center sm:justify-end gap-2 pt-1 sm:pt-0">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold uppercase tracking-wider border ${isAdmin
                    ? 'bg-amber-950/80 border-amber-500/50 text-amber-300'
                    : 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'
                    }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{userRole}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold uppercase tracking-wider bg-emerald-950/80 border border-emerald-500/50 text-emerald-300">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Active</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-200 font-sans tracking-wide">
              Profile Information
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
              <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <span>User Identifier</span>
              </div>
              <div className="text-sm font-mono font-semibold text-slate-100">
                {user?.userId || 'N/A'}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
              <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <span>Email Address</span>
              </div>
              <div className="text-sm font-mono text-slate-100">
                {user?.email || 'N/A'}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
              <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <span>Assigned Role</span>
              </div>
              <div className="text-sm font-mono font-bold text-amber-300 uppercase">
                {user?.role || 'N/A'}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
              <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <span>Session Status</span>
              </div>
              <div className="text-sm font-mono text-emerald-400 flex items-center gap-1.5 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Authenticated</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
              <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <span>Created At</span>
              </div>
              <div className="text-xs font-mono text-slate-300">
                {formatDateTime(user?.createdAt)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
              <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <span>Last Updated</span>
              </div>
              <div className="text-xs font-mono text-slate-300">
                {formatDateTime(user?.updatedAt || user?.createdAt)}
              </div>
            </div>

          </div>
        </div>

      </div>

      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-amber-500/40 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(245,158,11,0.25)] overflow-hidden animate-in zoom-in-95 duration-200">

            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white font-sans">
                  Reset Password
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-5 space-y-4">

              {passwordError && (
                <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-500/60 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Current Password</span>
                  <span className="text-[10px] text-slate-500 font-mono">Verification</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    required
                    className="w-full px-3 py-2 pr-9 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    required
                    minLength={6}
                    className="w-full px-3 py-2 pr-9 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    minLength={6}
                    className="w-full px-3 py-2 pr-9 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-cyan-400" />
                  <span>Secured</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsResetModalOpen(false)}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isResettingPassword}
                    className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.4)] cursor-pointer transition-all disabled:opacity-50"
                  >
                    {isResettingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Save Password</span>
                  </button>
                </div>
              </div>

            </form>

          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-cyan-500/40 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(6,182,212,0.25)] overflow-hidden animate-in zoom-in-95 duration-200">

            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white font-sans">
                  Edit Profile
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="p-5 space-y-4">

              {profileError && (
                <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-500/60 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              {profileSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Your Full Name"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60 font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Email Address (Immutable)</label>
                <input
                  type="text"
                  value={userEmail}
                  disabled
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/50 border border-slate-800 text-xs text-slate-500 cursor-not-allowed font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-pointer transition-all disabled:opacity-50"
                >
                  {isUpdatingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Changes</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
