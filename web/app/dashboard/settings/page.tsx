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
          <Orbit className="w-6 h-6 text-[#5B8DEF] animate-spin" />
          <span className="text-xs text-[#8B92A0] font-mono uppercase tracking-wider">
            Loading Account Details...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#E8EAED]">
            Account Settings
          </h1>
          <p className="text-xs text-[#8B92A0] font-mono mt-0.5">
            Mission Control authenticated user profile & credentials
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
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
            className="px-3 py-1.5 rounded-lg bg-[#161A22] border border-[#232833] hover:border-[#D9A441] text-[#D9A441] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 text-[#D9A441]" />
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
            className="px-3 py-1.5 rounded-lg bg-[#161A22] border border-[#232833] hover:border-[#5B8DEF] text-[#5B8DEF] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-[#5B8DEF]" />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-[#12151C] border border-[#232833] p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-6 border-b border-[#232833]">
          <div
            className={`w-14 h-14 rounded-lg flex items-center justify-center font-bold text-lg shrink-0 bg-[#161A22] border border-[#232833] ${
              isAdmin ? 'text-[#D9A441]' : 'text-[#5B8DEF]'
            }`}
          >
            {initials}
          </div>

          <div className="space-y-1 text-center sm:text-left flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#E8EAED] tracking-tight">{userDisplayName}</h2>
                <p className="text-xs text-[#8B92A0] font-mono">{userEmail}</p>
              </div>

              <div className="flex items-center justify-center sm:justify-end gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border bg-[#161A22] ${
                    isAdmin
                      ? 'border-[#D9A441]/40 text-[#D9A441]'
                      : 'border-[#5B8DEF]/40 text-[#5B8DEF]'
                  }`}
                >
                  <UserCheck className="w-3 h-3" />
                  <span>{userRole}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-[#161A22] border border-[#3FB68B]/40 text-[#3FB68B]">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Active</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#8B92A0]">
            System Metadata
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-[#0A0C10] border border-[#232833] space-y-0.5">
              <div className="text-[11px] text-[#4E5462] font-mono">User Identifier</div>
              <div className="text-xs font-mono text-[#E8EAED]">{user?.userId || 'N/A'}</div>
            </div>

            <div className="p-3 rounded-lg bg-[#0A0C10] border border-[#232833] space-y-0.5">
              <div className="text-[11px] text-[#4E5462] font-mono">Email Address</div>
              <div className="text-xs font-mono text-[#E8EAED]">{user?.email || 'N/A'}</div>
            </div>

            <div className="p-3 rounded-lg bg-[#0A0C10] border border-[#232833] space-y-0.5">
              <div className="text-[11px] text-[#4E5462] font-mono">Assigned Role</div>
              <div className="text-xs font-mono text-[#5B8DEF] uppercase">{user?.role || 'N/A'}</div>
            </div>

            <div className="p-3 rounded-lg bg-[#0A0C10] border border-[#232833] space-y-0.5">
              <div className="text-[11px] text-[#4E5462] font-mono">Telemetry Status</div>
              <div className="text-xs font-mono text-[#3FB68B] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3FB68B] inline-block" />
                <span>Synchronized (Active Gateway)</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#0A0C10] border border-[#232833] space-y-0.5">
              <div className="text-[11px] text-[#4E5462] font-mono">Registration Timestamp</div>
              <div className="text-xs font-mono text-[#8B92A0]">{formatDateTime(user?.createdAt)}</div>
            </div>

            <div className="p-3 rounded-lg bg-[#0A0C10] border border-[#232833] space-y-0.5">
              <div className="text-[11px] text-[#4E5462] font-mono">Last Record Modification</div>
              <div className="text-xs font-mono text-[#8B92A0]">{formatDateTime(user?.updatedAt || user?.createdAt)}</div>
            </div>
          </div>
        </div>
      </div>

      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md rounded-xl bg-[#12151C] border border-[#232833] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[#232833] flex items-center justify-between bg-[#0A0C10]">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#E8EAED]">
                Reset Password
              </h3>
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="w-6 h-6 rounded bg-[#161A22] hover:bg-[#232833] text-[#8B92A0] hover:text-[#E8EAED] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-5 space-y-4 font-sans">
              {passwordError && (
                <div className="p-2.5 rounded-md bg-[#161A22] border border-[#D9534F]/50 text-[#D9534F] text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#D9534F] shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="p-2.5 rounded-md bg-[#161A22] border border-[#3FB68B]/50 text-[#3FB68B] text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#3FB68B] shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-[#8B92A0]">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    required
                    className="w-full px-3 py-1.5 pr-9 rounded-md bg-[#0A0C10] border border-[#232833] text-xs text-[#E8EAED] placeholder:text-[#4E5462] focus:outline-none focus:border-[#D9A441] font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4E5462] hover:text-[#8B92A0] transition-colors cursor-pointer"
                  >
                    {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[#8B92A0]">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    required
                    minLength={6}
                    className="w-full px-3 py-1.5 pr-9 rounded-md bg-[#0A0C10] border border-[#232833] text-xs text-[#E8EAED] placeholder:text-[#4E5462] focus:outline-none focus:border-[#D9A441] font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4E5462] hover:text-[#8B92A0] transition-colors cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[#8B92A0]">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    minLength={6}
                    className="w-full px-3 py-1.5 rounded-md bg-[#0A0C10] border border-[#232833] text-xs text-[#E8EAED] placeholder:text-[#4E5462] focus:outline-none focus:border-[#D9A441] font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4E5462] hover:text-[#8B92A0] transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-[#232833]">
                <div className="text-[10px] text-[#4E5462] font-mono flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-[#5B8DEF]" />
                  <span>Secured Endpoint</span>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setIsResetModalOpen(false)}
                    className="px-3 py-1.5 rounded-md bg-[#0A0C10] hover:bg-[#161A22] text-[#8B92A0] cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isResettingPassword}
                    className="px-4 py-1.5 rounded-md bg-[#161A22] border border-[#D9A441]/50 hover:bg-[#232833] text-[#D9A441] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
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
          <div className="relative w-full max-w-md rounded-xl bg-[#12151C] border border-[#232833] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[#232833] flex items-center justify-between bg-[#0A0C10]">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#E8EAED]">
                Edit Profile
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="w-6 h-6 rounded bg-[#161A22] hover:bg-[#232833] text-[#8B92A0] hover:text-[#E8EAED] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="p-5 space-y-4 font-sans">
              {profileError && (
                <div className="p-2.5 rounded-md bg-[#161A22] border border-[#D9534F]/50 text-[#D9534F] text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#D9534F] shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              {profileSuccess && (
                <div className="p-2.5 rounded-md bg-[#161A22] border border-[#3FB68B]/50 text-[#3FB68B] text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#3FB68B] shrink-0" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-[#8B92A0]">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Your Full Name"
                  required
                  className="w-full px-3 py-1.5 rounded-md bg-[#0A0C10] border border-[#232833] text-xs text-[#E8EAED] placeholder:text-[#4E5462] focus:outline-none focus:border-[#5B8DEF]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[#8B92A0]">Email Address (Immutable)</label>
                <input
                  type="text"
                  value={userEmail}
                  disabled
                  className="w-full px-3 py-1.5 rounded-md bg-[#0A0C10]/50 border border-[#232833] text-xs text-[#4E5462] cursor-not-allowed font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 font-mono text-xs border-t border-[#232833]">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3 py-1.5 rounded-md bg-[#0A0C10] hover:bg-[#161A22] text-[#8B92A0] cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="px-4 py-1.5 rounded-md bg-[#161A22] border border-[#5B8DEF]/50 hover:bg-[#232833] text-[#5B8DEF] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
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
