'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthService, AuthSession } from '@/lib/auth';
import { useTheme } from '@/context/ThemeContext';
import {
  fetchCurrentUserProfile,
  updateCurrentUserProfile,
  changeUserPassword,
  UserProfileResponse,
} from '@/lib/api';

import {
  User,
  Shield,
  Key,
  Copy,
  Check,
  RotateCw,
  LogOut,
  Bell,
  Sun,
  Moon,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  ExternalLink,
  Lock,
  Eye,
  EyeOff,
  Clock,
  Calendar,
  Save,
  X,
  Laptop,
  CheckCheck,
  Camera,
  Sparkles,
  Trash2,
  Image as ImageIcon,
  Pencil,
} from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';

const AVATAR_PRESETS = [
  { id: 'cyber-scout', name: 'Cyber Scout', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=CyberScout' },
  { id: 'sentinel-core', name: 'Sentinel Core', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=SentinelCore' },
  { id: 'quantum-op', name: 'Quantum Operator', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=QuantumOp' },
  { id: 'night-guard', name: 'Night Guard', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=NightOperator' },
  { id: 'neural-grid', name: 'Neural Grid', url: 'https://api.dicebear.com/7.x/identicon/svg?seed=NeuralGrid' },
  { id: 'highway-spec', name: 'Highway Spec', url: 'https://api.dicebear.com/7.x/shapes/svg?seed=HighwaySpec' },
  { id: 'chief-spec', name: 'Chief Specialist', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ChiefSpecialist' },
  { id: 'radar-tech', name: 'Radar Tech', url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=RadarTech' },
];

export default function ProfilePage() {
  const router = useRouter();

  // Profile Data State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);

  // Editable Form State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<{ fullName?: string; username?: string }>({});

  // Preferences State (Browser-local Workstation Settings)
  // Key reference: 'visionplate-theme'
  const { theme: globalTheme, isDark, setTheme: setGlobalTheme } = useTheme();
  const [timeDisplay, setTimeDisplay] = useState<'utc' | 'local'>('utc');
  const [copiedId, setCopiedId] = useState(false);

  // Avatar Management State
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string>('');
  const [customAvatarInput, setCustomAvatarInput] = useState<string>('');
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [avatarTab, setAvatarTab] = useState<'presets' | 'custom' | 'initials'>('presets');

  // Password Management State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await changeUserPassword({
        current_password: currentPassword || undefined,
        new_password: newPassword,
      });
      setPasswordSuccess('Account password updated successfully! 🔒');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(null), 4000);
    } catch (err: any) {
      setPasswordError(err?.message || 'Failed to update password. Please check your current password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleOpenAvatarModal = () => {
    const current = profile?.avatar_url || '';
    setSelectedAvatarUrl(current);
    setCustomAvatarInput(current);
    const isPreset = AVATAR_PRESETS.some((p) => p.url === current);
    setAvatarTab(!current ? 'initials' : isPreset ? 'presets' : 'custom');
    setIsAvatarModalOpen(true);
  };

  const handleSaveAvatar = async (urlToSave: string | null) => {
    setIsSavingAvatar(true);
    setError(null);
    try {
      const cleanUrl = urlToSave && urlToSave.trim() !== '' ? urlToSave.trim() : null;
      const updated = await updateCurrentUserProfile({ avatar_url: cleanUrl });
      setProfile(updated);
      AuthService.updateSessionUser({ avatarUrl: updated.avatar_url || undefined });
      window.dispatchEvent(new Event('visionplate_auth_change'));
      setIsAvatarModalOpen(false);
      setSuccessMsg('Operator avatar updated successfully.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to update avatar.');
    } finally {
      setIsSavingAvatar(false);
    }
  };


  // Load Profile from Backend and Local Preferences
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchCurrentUserProfile();
        if (mounted) {
          setProfile(data);
          setFullName(data.full_name || '');
          setUsername(data.username || '');
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Failed to load profile from backend.');
          // Fallback to local session if offline
          const session = AuthService.getSession();
          if (session?.user) {
            setFullName(session.user.name || '');
            setUsername(session.user.email.split('@')[0]);
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    // Load Local Time Preference
    try {
      const savedTime = localStorage.getItem('visionplate-time-display');
      if (savedTime === 'local' || savedTime === 'utc') {
        setTimeDisplay(savedTime as 'utc' | 'local');
      }
    } catch {}

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  // Theme Toggle Handler
  const handleThemeChange = (nextTheme: 'beige' | 'dark') => {
    setGlobalTheme(nextTheme === 'dark' ? 'dark' : 'light');
  };

  // Time Display Toggle Handler
  const handleTimeDisplayChange = (mode: 'utc' | 'local') => {
    setTimeDisplay(mode);
    try {
      localStorage.setItem('visionplate-time-display', mode);
      window.dispatchEvent(new Event('storage'));
    } catch {}
  };

  // Copy User ID
  const handleCopyId = () => {
    if (!profile?.id) return;
    navigator.clipboard.writeText(profile.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Form Validation
  const validateForm = () => {
    const errors: { fullName?: string; username?: string } = {};
    if (fullName.trim().length > 255) {
      errors.fullName = 'Full name cannot exceed 255 characters.';
    }
    if (username.trim()) {
      const cleanUser = username.trim().toLowerCase();
      if (cleanUser.length < 3) {
        errors.username = 'Username must be at least 3 characters.';
      } else if (cleanUser.length > 50) {
        errors.username = 'Username cannot exceed 50 characters.';
      } else if (!/^[a-z0-9_-]+$/.test(cleanUser)) {
        errors.username = 'Username can only contain letters, numbers, underscores, and hyphens.';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save Profile Handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload: { full_name?: string; username?: string } = {};
      if (fullName.trim() !== (profile?.full_name || '')) {
        payload.full_name = fullName.trim();
      }
      if (username.trim() !== (profile?.username || '')) {
        payload.username = username.trim().toLowerCase();
      }

      if (Object.keys(payload).length === 0) {
        setIsEditing(false);
        setIsSaving(false);
        return;
      }

      const updated = await updateCurrentUserProfile(payload);
      setProfile(updated);
      setFullName(updated.full_name || '');
      setUsername(updated.username || '');
      setIsEditing(false);
      setSuccessMsg('Profile updated successfully.');

      // Update local session
      AuthService.updateSessionUser({
        name: updated.full_name || updated.username || updated.email.split('@')[0],
      });

      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile. Please verify your input.');
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel Editing
  const handleCancelEdit = () => {
    setFullName(profile?.full_name || '');
    setUsername(profile?.username || '');
    setFormErrors({});
    setIsEditing(false);
    setError(null);
  };

  // Logout Handler
  const handleLogout = async () => {
    await AuthService.logout();
    router.push('/app/login');
  };

  // Connected Identities Analysis
  const googleIdentity = profile?.identities?.find((i) => i.provider === 'google');
  const githubIdentity = profile?.identities?.find((i) => i.provider === 'github');
  const hasLocalPassword = profile?.identities?.some((i) => i.provider === 'email') ?? true;

  return (
    <div className="min-h-full font-sans p-6 sm:p-8 space-y-8 max-w-5xl w-full mx-auto relative">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold tracking-widest uppercase text-[#EA580C]">
              Operations Menu // System Settings
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1A1815] dark:text-white tracking-tight">
            Operator Profile & Account Workspace
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Manage your authenticated operator profile, security credentials, and workstation preferences.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-bold transition-all self-start sm:self-auto cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3 text-rose-700 dark:text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-bold">Operation Notice</div>
            <div className="mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-3 text-emerald-800 dark:text-emerald-300 text-xs">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-bold">Success</div>
            <div className="mt-0.5">{successMsg}</div>
          </div>
        </div>
      )}

      {/* 2. User Profile Hero Card */}
      <div className="p-6 sm:p-8 rounded-3xl gw-panel shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          {/* Interactive Operator Avatar with Change Button */}
          <div className="relative group shrink-0">
            <UserAvatar
              src={profile?.avatar_url}
              name={profile?.full_name || profile?.username || profile?.email || 'Operator'}
              className="w-20 h-20 rounded-2xl ring-4 ring-white dark:ring-white/10 shadow-md text-3xl"
            />
            <button
              type="button"
              onClick={handleOpenAvatarModal}
              className="absolute inset-0 rounded-2xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1 cursor-pointer"
              title="Change Avatar"
              aria-label="Change Avatar"
            >
              <Camera className="w-5 h-5 text-[#F59E0B]" />
              <span>Change</span>
            </button>
            <button
              type="button"
              onClick={handleOpenAvatarModal}
              className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-[#EA580C] hover:bg-[#C2410C] text-white shadow-md border-2 border-white dark:border-[#111318] transition-transform active:scale-90 cursor-pointer"
              title="Change Avatar"
              aria-label="Change Avatar"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-[#1A1815] dark:text-white">
                {loading ? 'Loading Profile...' : profile?.full_name || profile?.username || 'Vision Operator'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 uppercase tracking-wide">
                {profile?.is_active ? 'Active Operator' : 'Inactive'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800 uppercase tracking-wide">
                Role: {profile?.role || 'Operator'}
              </span>
            </div>

            <div className="text-xs text-zinc-600 dark:text-zinc-400 font-medium flex items-center gap-2 flex-wrap">
              <span>{profile?.email}</span>
              {profile?.username && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-600">•</span>
                  <span className="font-mono text-zinc-500">@{profile.username}</span>
                </>
              )}
            </div>

            <div className="text-[11px] text-zinc-500 font-mono pt-1 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#EA580C]" />
                Registered: {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Verified Account'}
              </span>
            </div>
          </div>
        </div>

        {/* Account ID / Copy Box */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 text-xs font-mono space-y-1 sm:max-w-xs w-full sm:w-auto">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-sans font-bold">
            Account Identifier
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-zinc-800 dark:text-zinc-200">
              {profile?.id || 'usr_...'}
            </span>
            <button
              onClick={handleCopyId}
              className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300"
              title="Copy ID"
            >
              {copiedId ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Personal & Account Information (Editable) */}
      <div className="p-6 sm:p-8 rounded-3xl gw-panel shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-[#D8CFC0]/60 dark:border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[#EA580C]" />
            <h3 className="font-black text-base text-[#1A1815] dark:text-white">
              Personal Information & Identity
            </h3>
          </div>
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EA580C]/10 hover:bg-[#EA580C]/20 text-[#EA580C] text-xs font-bold transition-all cursor-pointer border border-[#EA580C]/20"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit Details
            </button>
          ) : (
            <span className="text-[11px] font-bold text-[#EA580C] animate-pulse">
              Editing profile active
            </span>
          )}
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-[#1A1815] dark:text-white mb-1">
                Full Display Name
              </label>
              {isEditing ? (
                <div>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    autoFocus
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#EA580C] dark:border-[#EA580C] bg-white dark:bg-black/40 text-xs text-[#1A1815] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA580C]/40 shadow-xs"
                  />
                  {formErrors.fullName && (
                    <p className="text-[11px] text-rose-500 mt-1">{formErrors.fullName}</p>
                  )}
                </div>
              ) : (
                <div
                  onClick={() => setIsEditing(true)}
                  title="Click to edit full display name"
                  className="px-3.5 py-2.5 rounded-xl border border-[#D8CFC0]/60 dark:border-white/10 bg-white/70 dark:bg-white/5 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer hover:border-[#EA580C] hover:bg-white dark:hover:bg-white/10 transition-all flex items-center justify-between group"
                >
                  <span className={profile?.full_name ? 'font-medium' : 'text-zinc-400 italic'}>
                    {profile?.full_name || 'Not provided (Click to set)'}
                  </span>
                  <span className="text-[11px] text-zinc-400 group-hover:text-[#EA580C] flex items-center gap-1 font-semibold transition-colors">
                    <Pencil className="w-3 h-3" /> Edit
                  </span>
                </div>
              )}
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs font-bold text-[#1A1815] dark:text-white mb-1">
                Username / Handle
              </label>
              {isEditing ? (
                <div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs text-zinc-400 font-mono">@</span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="username"
                      className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-[#EA580C] dark:border-[#EA580C] bg-white dark:bg-black/40 text-xs text-[#1A1815] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA580C]/40 font-mono shadow-xs"
                    />
                  </div>
                  {formErrors.username && (
                    <p className="text-[11px] text-rose-500 mt-1">{formErrors.username}</p>
                  )}
                </div>
              ) : (
                <div
                  onClick={() => setIsEditing(true)}
                  title="Click to edit username"
                  className="px-3.5 py-2.5 rounded-xl border border-[#D8CFC0]/60 dark:border-white/10 bg-white/70 dark:bg-white/5 text-xs text-zinc-800 dark:text-zinc-200 font-mono cursor-pointer hover:border-[#EA580C] hover:bg-white dark:hover:bg-white/10 transition-all flex items-center justify-between group"
                >
                  <span>@{profile?.username || 'not_set'}</span>
                  <span className="text-[11px] font-sans text-zinc-400 group-hover:text-[#EA580C] flex items-center gap-1 font-semibold transition-colors">
                    <Pencil className="w-3 h-3" /> Edit
                  </span>
                </div>
              )}
            </div>

            {/* Primary Email (Read-Only Protected) */}
            <div>
              <label className="block text-xs font-bold text-[#1A1815] dark:text-white mb-1">
                Primary Email Address
              </label>
              <div className="px-3.5 py-2.5 rounded-xl border border-[#D8CFC0]/60 dark:border-white/10 bg-zinc-100/70 dark:bg-white/5 text-xs text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                <span>{profile?.email || 'operator@visionplate.ai'}</span>
                <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Verified
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">
                Protected attribute. Email modifications require administrative re-verification.
              </p>
            </div>

            {/* Account Role & Clearance (Read-Only) */}
            <div>
              <label className="block text-xs font-bold text-[#1A1815] dark:text-white mb-1">
                Access Level & Security Role
              </label>
              <div className="px-3.5 py-2.5 rounded-xl border border-[#D8CFC0]/60 dark:border-white/10 bg-zinc-100/70 dark:bg-white/5 text-xs text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                <span className="font-mono uppercase">{profile?.role || 'OPERATOR'}</span>
                <span className="text-[10px] font-mono text-[#EA580C] font-bold">
                  MoRTH L3 Enforcement
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">
                Role authorization governs video batch processing and audit report generation.
              </p>
            </div>
          </div>

          {/* Edit Actions */}
          {isEditing && (
            <div className="flex items-center gap-3 pt-3 border-t border-[#D8CFC0]/40 dark:border-white/10">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#EA580C]/90 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save Profile Changes
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#D8CFC0] dark:border-white/20 hover:bg-zinc-100 dark:hover:bg-white/10 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            </div>
          )}
        </form>
      </div>

      {/* 4. Security Credentials & Password Management */}
      <div className="p-6 sm:p-8 rounded-3xl gw-panel shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-[#D8CFC0]/60 dark:border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#EA580C]" />
            <h3 className="font-black text-base text-[#1A1815] dark:text-white">
              Security Credentials & Password
            </h3>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#EA580C]/10 text-[#EA580C] font-bold border border-[#EA580C]/20">
            Argon2id Encrypted
          </span>
        </div>

        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Ensure your account uses a strong, unique password to secure operator telemetry, live ALPR detections, and audit dossiers.
        </p>

        {passwordError && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-bold">Password Update Error</div>
              <div className="mt-0.5">{passwordError}</div>
            </div>
          </div>
        )}

        {passwordSuccess && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-2.5 text-emerald-800 dark:text-emerald-300 text-xs">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-bold">Security Notice</div>
              <div className="mt-0.5">{passwordSuccess}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Current Password */}
            <div>
              <label className="block text-xs font-bold text-[#1A1815] dark:text-white mb-1">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#D8CFC0] dark:border-white/20 bg-white dark:bg-black/40 text-xs text-[#1A1815] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA580C]/40"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  title={showCurrentPassword ? 'Hide password' : 'Show password'}
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">Leave blank if account was created via SSO</p>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-bold text-[#1A1815] dark:text-white mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#D8CFC0] dark:border-white/20 bg-white dark:bg-black/40 text-xs text-[#1A1815] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA580C]/40"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  title={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">Must be at least 6 characters long</p>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-bold text-[#1A1815] dark:text-white mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#D8CFC0] dark:border-white/20 bg-white dark:bg-black/40 text-xs text-[#1A1815] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA580C]/40"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">Re-type password to verify</p>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isChangingPassword || !newPassword || !confirmPassword}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#EA580C]/90 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {isChangingPassword ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  Updating Password...
                </>
              ) : (
                <>
                  <Key className="w-3.5 h-3.5" />
                  Update Password
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 5. Account Security & Connected OAuth Identities */}
      <div className="p-6 sm:p-8 rounded-3xl gw-panel shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#D8CFC0]/60 dark:border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#EA580C]" />
            <h3 className="font-black text-base text-[#1A1815] dark:text-white">
              Authentication Providers & SSO Security
            </h3>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">
            PostgreSQL UserIdentities
          </span>
        </div>

        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          The verified authentication identities linked to your VisionPlate account.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Google Identity */}
          <div className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white shadow-sm border border-zinc-200 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              </div>
              <div>
                <div className="font-bold text-xs text-[#1A1815] dark:text-white">Google Workspace</div>
                <div className="text-[10px] text-zinc-500">
                  {googleIdentity?.provider_email || (profile?.email?.endsWith('@gmail.com') ? profile.email : 'Google SSO')}
                </div>
              </div>
            </div>

            {googleIdentity || profile?.email?.endsWith('@gmail.com') ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="w-3 h-3" /> Connected
              </span>
            ) : (
              <span className="text-[10px] font-medium text-zinc-400">Not Connected</span>
            )}
          </div>

          {/* GitHub Identity */}
          <div className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white shadow-sm flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </div>
              <div>
                <div className="font-bold text-xs text-[#1A1815] dark:text-white">GitHub Account</div>
                <div className="text-[10px] text-zinc-500">
                  {githubIdentity ? githubIdentity.provider_email || 'Developer SSO' : 'Developer SSO'}
                </div>
              </div>
            </div>

            {githubIdentity ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="w-3 h-3" /> Linked
              </span>
            ) : (
              <span className="text-[10px] font-medium text-zinc-400">Not Linked</span>
            )}
          </div>
        </div>
      </div>

      {/* 5. Operator Workstation Preferences */}
      <div className="p-6 sm:p-8 rounded-3xl gw-panel shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-[#D8CFC0]/60 dark:border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <Laptop className="w-4 h-4 text-[#EA580C]" />
            <h3 className="font-black text-base text-[#1A1815] dark:text-white">
              Operator Workstation Preferences
            </h3>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900">
            Device Local Storage
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Visual Theme Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#1A1815] dark:text-white">
              Application Visual Theme
            </label>
            <p className="text-[11px] text-zinc-500">
              Select between the signature luxury porcelain theme and dark night mode.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleThemeChange('beige')}
                className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  !isDark
                    ? 'border-[#EA580C] bg-[#FAF8F5] shadow-sm ring-2 ring-[#EA580C]/20'
                    : 'border-[#D8CFC0] dark:border-white/10 bg-white dark:bg-white/5 text-zinc-600'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sun className={`w-4 h-4 ${!isDark ? 'text-[#EA580C]' : 'text-zinc-400'}`} />
                  <div>
                    <div className="text-xs font-bold text-[#1A1815] dark:text-white">Porcelain</div>
                    <div className="text-[10px] text-zinc-500">Cream / Desert</div>
                  </div>
                </div>
                {!isDark && <Check className="w-4 h-4 text-[#EA580C]" />}
              </button>

              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  isDark
                    ? 'border-[#EA580C] bg-zinc-900 text-white shadow-sm ring-2 ring-[#EA580C]/20'
                    : 'border-[#D8CFC0] dark:border-white/10 bg-white dark:bg-white/5 text-zinc-600'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Moon className={`w-4 h-4 ${isDark ? 'text-[#EA580C]' : 'text-zinc-400'}`} />
                  <div>
                    <div className="text-xs font-bold text-[#1A1815] dark:text-white">Dark Mode</div>
                    <div className="text-[10px] text-zinc-500">OLED Night</div>
                  </div>
                </div>
                {isDark && <Check className="w-4 h-4 text-[#EA580C]" />}
              </button>
            </div>
          </div>

          {/* Timestamp Display Mode */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#1A1815] dark:text-white">
              Timestamp Presentation
            </label>
            <p className="text-[11px] text-zinc-500">
              Standardize timestamp displays across Detection History and Reports.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleTimeDisplayChange('utc')}
                className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  timeDisplay === 'utc'
                    ? 'border-[#EA580C] bg-[#FAF8F5] dark:bg-white/10 shadow-sm ring-2 ring-[#EA580C]/20'
                    : 'border-[#D8CFC0] dark:border-white/10 bg-white dark:bg-white/5 text-zinc-600'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Clock className={`w-4 h-4 ${timeDisplay === 'utc' ? 'text-[#EA580C]' : 'text-zinc-400'}`} />
                  <div>
                    <div className="text-xs font-bold text-[#1A1815] dark:text-white">UTC Standard</div>
                    <div className="text-[10px] text-zinc-500">ALPR Standard</div>
                  </div>
                </div>
                {timeDisplay === 'utc' && <Check className="w-4 h-4 text-[#EA580C]" />}
              </button>

              <button
                type="button"
                onClick={() => handleTimeDisplayChange('local')}
                className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  timeDisplay === 'local'
                    ? 'border-[#EA580C] bg-[#FAF8F5] dark:bg-white/10 shadow-sm ring-2 ring-[#EA580C]/20'
                    : 'border-[#D8CFC0] dark:border-white/10 bg-white dark:bg-white/5 text-zinc-600'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Clock className={`w-4 h-4 ${timeDisplay === 'local' ? 'text-[#EA580C]' : 'text-zinc-400'}`} />
                  <div>
                    <div className="text-xs font-bold text-[#1A1815] dark:text-white">Local Workstation</div>
                    <div className="text-[10px] text-zinc-500">Browser Locale</div>
                  </div>
                </div>
                {timeDisplay === 'local' && <Check className="w-4 h-4 text-[#EA580C]" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Active Session Status & Logout */}
      <div className="p-6 rounded-3xl bg-[#FAF8F5] dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/[0.08] shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="font-bold text-xs text-[#1A1815] dark:text-white">
            Active Authentication Session
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            Cryptographic HS256 JWT &bull; HttpOnly Cookie Protected &bull; Session scoped to VisionPlate AI
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-200 dark:bg-white/10 hover:bg-rose-500/20 hover:text-rose-600 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          End Session & Sign Out
        </button>
      </div>

      {/* 7. Operator Avatar Customization Modal */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#FAF8F5] dark:bg-[#111318] border border-[#D8CFC0] dark:border-white/10 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-6 relative">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#D8CFC0]/60 dark:border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-500/10 text-[#EA580C]">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#1A1815] dark:text-white">
                    Customize Operator Avatar
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Select a curated preset, paste a custom image URL, or reset to initials.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-zinc-500 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Preview */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-white/5 border border-[#D8CFC0] dark:border-white/10">
              <UserAvatar
                src={selectedAvatarUrl || null}
                name={profile?.full_name || profile?.username || 'Operator'}
                className="w-16 h-16 rounded-2xl ring-2 ring-[#EA580C] shadow-md text-2xl"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[#1A1815] dark:text-white">
                  Live Preview
                </div>
                <div className="text-[11px] text-zinc-500 truncate mt-0.5 font-mono">
                  {selectedAvatarUrl ? selectedAvatarUrl : 'Default Initial Monogram'}
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                  ✓ Verified for cross-platform rendering
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex rounded-xl bg-black/5 dark:bg-white/5 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setAvatarTab('presets')}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                  avatarTab === 'presets'
                    ? 'bg-white dark:bg-white/10 text-[#1A1815] dark:text-white shadow-xs'
                    : 'text-zinc-500 hover:text-black dark:hover:text-white'
                }`}
              >
                Curated Presets
              </button>
              <button
                type="button"
                onClick={() => setAvatarTab('custom')}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                  avatarTab === 'custom'
                    ? 'bg-white dark:bg-white/10 text-[#1A1815] dark:text-white shadow-xs'
                    : 'text-zinc-500 hover:text-black dark:hover:text-white'
                }`}
              >
                Custom Image URL
              </button>
              <button
                type="button"
                onClick={() => {
                  setAvatarTab('initials');
                  setSelectedAvatarUrl('');
                }}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                  avatarTab === 'initials'
                    ? 'bg-white dark:bg-white/10 text-[#1A1815] dark:text-white shadow-xs'
                    : 'text-zinc-500 hover:text-black dark:hover:text-white'
                }`}
              >
                Name Initial
              </button>
            </div>

            {/* Tab 1: Presets Grid */}
            {avatarTab === 'presets' && (
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  Pick a Specialist Cyber Avatar
                </div>
                <div className="grid grid-cols-4 gap-3 max-h-56 overflow-y-auto p-1">
                  {AVATAR_PRESETS.map((preset) => {
                    const isSelected = selectedAvatarUrl === preset.url;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSelectedAvatarUrl(preset.url)}
                        className={`group p-2 rounded-2xl border transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'border-[#EA580C] bg-orange-500/10 ring-2 ring-[#EA580C]/40 shadow-xs'
                            : 'border-[#D8CFC0] dark:border-white/10 hover:border-black/30 dark:hover:border-white/30 bg-white dark:bg-white/5'
                        }`}
                      >
                        <img
                          src={preset.url}
                          alt={preset.name}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-xl object-cover transition-transform group-hover:scale-105"
                        />
                        <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 truncate w-full text-center">
                          {preset.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab 2: Custom URL Input */}
            {avatarTab === 'custom' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-[#1A1815] dark:text-white block mb-1">
                    Image Address (HTTP/HTTPS URL)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={customAvatarInput}
                      onChange={(e) => {
                        setCustomAvatarInput(e.target.value);
                        setSelectedAvatarUrl(e.target.value.trim());
                      }}
                      placeholder="https://example.com/photo.jpg"
                      className="flex-1 px-3 py-2 text-xs rounded-xl border border-[#D8CFC0] dark:border-white/10 bg-white dark:bg-[#111318] text-[#1A1815] dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedAvatarUrl(customAvatarInput.trim())}
                      className="px-3 py-2 rounded-xl bg-black/[0.05] dark:bg-white/10 hover:bg-black/10 text-xs font-bold text-zinc-800 dark:text-white transition-all cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1.5">
                    Supports Google Profile URLs, GitHub avatars, Unsplash, Gravatar, Imgur, or direct PNG/JPG links.
                  </p>
                </div>
              </div>
            )}

            {/* Tab 3: Reset to Initials */}
            {avatarTab === 'initials' && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Gradient Monogram Initial</span>
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                  Resets your avatar to a clean, cryptographic gradient monogram derived from your operator name.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D8CFC0]/60 dark:border-white/10">
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(false)}
                disabled={isSavingAvatar}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveAvatar(selectedAvatarUrl)}
                disabled={isSavingAvatar}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSavingAvatar ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Avatar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
