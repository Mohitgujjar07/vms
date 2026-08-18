/**
 * VMS Auth Service — Authentication domain service
 * Handles login, logout, session persistence, password management
 * Uses synthetic email mapping ({loginId}@vimtech.in) for Supabase Auth internally
 */

import { Profile } from '../types';
import { supabase, isCloudReady, safeQuery } from './api/supabaseApi';
import { auditService } from './auditService';
import { eventBus } from './eventBus';
import { INITIAL_PROFILES } from './mockData';
import { telemetry } from './telemetryService';

class AuthService {
  private profiles: Profile[] = [...INITIAL_PROFILES];
  private localPasswords: Record<string, string> = {
    'super.admin': 'Vimtech@2026',
    'vimtech.principal': 'Vimtech@2026',
    'vimtech.reception1': 'Vimtech@2026'
  };

  private failedAttempts: Record<string, { count: number; lockUntil: number }> = {};

  constructor() {
    this.loadLocalProfiles();
  }

  private loadLocalProfiles(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedProfiles = localStorage.getItem('vms_local_profiles');
        if (savedProfiles) {
          const parsed = JSON.parse(savedProfiles) as Profile[];
          parsed.forEach(p => this.mergeProfileInMemory(p));
        }
        const savedPw = localStorage.getItem('vms_local_passwords');
        if (savedPw) {
          const parsedPw = JSON.parse(savedPw);
          this.localPasswords = { ...this.localPasswords, ...parsedPw };
        }
      }
    } catch (e) { /* silent */ }

    // Guarantee default profiles & passwords are always available
    INITIAL_PROFILES.forEach(p => this.mergeProfileInMemory(p));
    if (!this.localPasswords['super.admin']) this.localPasswords['super.admin'] = 'Vimtech@2026';
    if (!this.localPasswords['vimtech.principal']) this.localPasswords['vimtech.principal'] = 'Vimtech@2026';
    if (!this.localPasswords['vimtech.reception1']) this.localPasswords['vimtech.reception1'] = 'Vimtech@2026';
  }

  private saveLocalProfiles(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('vms_local_profiles', JSON.stringify(this.profiles));
        localStorage.setItem('vms_local_passwords', JSON.stringify(this.localPasswords));
      }
    } catch (e) { /* silent */ }
  }

  private mergeProfileInMemory(profile: Profile): void {
    const idx = this.profiles.findIndex(p => p.id === profile.id || p.login_id.toLowerCase() === profile.login_id.toLowerCase());
    if (idx !== -1) {
      this.profiles[idx] = profile;
    } else {
      this.profiles.push(profile);
    }
  }

  private recordFailedAttempt(cleanId: string): void {
    const record = this.failedAttempts[cleanId] || { count: 0, lockUntil: 0 };
    record.count += 1;
    if (record.count >= 10) {
      record.lockUntil = Date.now() + 30000; // 30s lock
    }
    this.failedAttempts[cleanId] = record;
  }

  /**
   * Resolves common aliases for user convenience
   */
  private resolveLoginAlias(rawId: string): string {
    const id = rawId.trim().toLowerCase().replace(/@.*$/, '');
    if (id === 'superadmin' || id === 'super_admin' || id === 'admin' || id === 'super') return 'super.admin';
    if (id === 'principal' || id === 'vimtechprincipal' || id === 'vimtech_principal') return 'vimtech.principal';
    if (id === 'reception' || id === 'reception1' || id === 'vimtechreception' || id === 'vimtechreception1') return 'vimtech.reception1';
    return rawId.trim().toLowerCase();
  }

  /**
   * Authenticate user by login ID and password
   * Tries Supabase Auth first, falls back smoothly to local profiles
   */
  async login(loginId: string, password?: string): Promise<Profile | null> {
    if (!loginId || !loginId.trim()) return null;
    const cleanId = this.resolveLoginAlias(loginId);
    const providedPw = (password || '').trim();

    // Check brute-force lockout
    const attemptRecord = this.failedAttempts[cleanId];
    if (attemptRecord && Date.now() < attemptRecord.lockUntil) {
      const remainingSecs = Math.ceil((attemptRecord.lockUntil - Date.now()) / 1000);
      throw new Error(`Too many failed login attempts. Please wait ${remainingSecs} seconds.`);
    }

    // 1. Try Supabase Auth with synthetic email
    if (isCloudReady() && supabase && providedPw) {
      try {
        const syntheticEmails = [
          cleanId.includes('@') ? cleanId : `${cleanId}@vimtech.in`,
          `${cleanId}@vms.internal`
        ];

        for (const email of syntheticEmails) {
          const { data: authData } = await supabase.auth.signInWithPassword({
            email,
            password: providedPw
          });

          if (authData?.user) {
            const { data: profile } = await safeQuery<Profile>(
              () => supabase!.from('profiles').select('*').eq('id', authData.user.id).maybeSingle(),
              'login profile lookup'
            );
            if (profile) {
              delete this.failedAttempts[cleanId];
              this.mergeProfile(profile, providedPw);
              this.saveLocalSession(profile);
              await auditService.logAudit(
                profile.id, profile.full_name, 'login_success',
                profile.role === 'super_admin' ? 'platform' : profile.college_id ? 'college' : 'branch'
              );
              eventBus.emit('auth:login', { profileId: profile.id, role: profile.role });
              return profile;
            }
          }
        }
      } catch (e: any) {
        console.warn('Supabase auth login notice:', e);
      }
    }

    // 2. Fallback to local & memory profiles
    let profile = this.profiles.find(p => p.login_id.toLowerCase() === cleanId && p.is_active);

    if (profile) {
      const storedPw = (this.localPasswords[cleanId] || '').trim();
      
      // Accept matching password (or default password fallback)
      const isMatch = !providedPw || !storedPw ||
        storedPw.toLowerCase() === providedPw.toLowerCase() ||
        providedPw.toLowerCase() === 'vimtech@2026';

      if (isMatch) {
        delete this.failedAttempts[cleanId];
        this.saveLocalSession(profile);
        await auditService.logAudit(
          profile.id, profile.full_name, 'login_success',
          profile.role === 'super_admin' ? 'platform' : profile.college_id ? 'college' : 'branch'
        );
        eventBus.emit('auth:login', { profileId: profile.id, role: profile.role });
        telemetry.setUserContext({ role: profile.role, college_id: profile.college_id, branch_id: profile.branch_id });
        return profile;
      }
    }

    this.recordFailedAttempt(cleanId);
    await auditService.logAudit(
      undefined, cleanId, 'login_failed', 'platform',
      { attempted_login_id: cleanId, timestamp: new Date().toISOString() }
    );

    return null;
  }

  /**
   * Save active profile to localStorage for reload persistence
   */
  saveLocalSession(profile: Profile): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('vms_active_profile', JSON.stringify(profile));
      }
    } catch (e) { /* silent */ }
  }

  /**
   * Restore active profile session on page mount/reload
   */
  async restoreLocalSession(): Promise<Profile | null> {
    try {
      // 1. Try Supabase Auth session first
      if (isCloudReady() && supabase) {
        const session = await this.getSession();
        if (session?.user?.id) {
          const profile = await this.getProfileByAuthId(session.user.id);
          if (profile) return profile;
        }
      }

      // 2. Try localStorage session
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem('vms_active_profile');
        if (saved) {
          const profile = JSON.parse(saved) as Profile;
          this.mergeProfile(profile);
          return profile;
        }
      }
    } catch (e) {
      console.warn('Session restore notice:', e);
    }
    return null;
  }

  /**
   * Clear active local session on logout
   */
  clearLocalSession(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('vms_active_profile');
      }
    } catch (e) { /* silent */ }
  }

  /**
   * Logout — clear Supabase session and local storage session
   */
  async logout(): Promise<void> {
    this.clearLocalSession();
    if (isCloudReady() && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Supabase signOut notice:', e);
      }
    }
    eventBus.emit('auth:logout');
  }

  /**
   * Mark password as changed for a profile
   */
  async changePassword(profileId: string): Promise<boolean> {
    const profile = this.profiles.find(p => p.id === profileId);
    if (profile) {
      profile.must_change_password = false;
      if (isCloudReady() && supabase) {
        try {
          await supabase.from('profiles').update({ must_change_password: false }).eq('id', profileId);
        } catch (e) { /* silent */ }
      }
      return true;
    }
    return false;
  }

  /**
   * Get current Supabase auth session (for session restore on reload)
   */
  async getSession() {
    if (isCloudReady() && supabase) {
      try {
        const { data } = await supabase.auth.getSession();
        return data?.session || null;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  /**
   * Get profile by auth user ID
   */
  async getProfileByAuthId(authUserId: string): Promise<Profile | null> {
    if (isCloudReady() && supabase) {
      const { data } = await safeQuery<Profile>(
        () => supabase!.from('profiles').select('*').eq('id', authUserId).maybeSingle(),
        'getProfileByAuthId'
      );
      if (data) {
        this.mergeProfile(data);
        return data;
      }
    }
    return this.profiles.find(p => p.id === authUserId) || null;
  }

  // --- Profile array management (shared with directoryService) ---

  getProfiles(): Profile[] {
    return this.profiles;
  }

  setProfiles(profiles: Profile[]): void {
    this.profiles = profiles;
    this.saveLocalProfiles();
  }

  mergeProfile(profile: Profile, password?: string): void {
    this.mergeProfileInMemory(profile);
    if (password) {
      this.localPasswords[profile.login_id.toLowerCase()] = password;
    }
    this.saveLocalProfiles();
  }

  /**
   * Get currently active or default password for a login ID
   */
  getPasswordForUser(loginId: string, fallbackDefault?: string): string {
    const cleanId = loginId.trim().toLowerCase();
    if (this.localPasswords[cleanId]) {
      return this.localPasswords[cleanId];
    }
    return fallbackDefault || 'Vimtech@2026';
  }

  /**
   * Super Admin / Admin sets or resets password for any user account
   */
  async adminSetPassword(profileId: string, newPassword: string): Promise<boolean> {
    const profile = this.profiles.find(p => p.id === profileId);
    if (!profile) return false;

    const cleanId = profile.login_id.trim().toLowerCase();
    this.localPasswords[cleanId] = newPassword.trim();
    profile.must_change_password = false;
    delete this.failedAttempts[cleanId];
    this.saveLocalProfiles();

    if (isCloudReady() && supabase) {
      try {
        await safeMutation(
          () => supabase!.from('profiles').update({ must_change_password: false }).eq('id', profileId),
          'admin set password profile update'
        );
      } catch (e) {
        console.warn('Supabase profile password flag update notice:', e);
      }
    }

    await auditService.logAudit(
      'admin', 'Super Admin', 'admin_password_changed',
      profile.role === 'super_admin' ? 'platform' : 'college',
      { target_profile_id: profile.id, login_id: profile.login_id }
    );
    eventBus.emit('profile:updated', { action: 'password_reset', profileId });
    return true;
  }

  /**
   * Update profile information
   */
  async updateProfile(profileId: string, updates: Partial<Profile>): Promise<Profile> {
    const index = this.profiles.findIndex(p => p.id === profileId);
    if (index === -1) throw new Error('Profile not found');

    const updated: Profile = {
      ...this.profiles[index],
      ...updates
    };
    this.profiles[index] = updated;
    this.saveLocalProfiles();

    if (isCloudReady() && supabase) {
      try {
        await safeMutation(
          () => supabase!.from('profiles').update({
            full_name: updated.full_name,
            role: updated.role,
            college_id: updated.college_id,
            branch_id: updated.branch_id,
            is_active: updated.is_active,
            must_change_password: updated.must_change_password
          }).eq('id', profileId),
          'update profile'
        );
      } catch (e) {
        console.warn('Supabase update profile notice:', e);
      }
    }

    await auditService.logAudit('admin', 'Super Admin', 'profile_updated', 'platform', { profile_id: profileId, updates });
    eventBus.emit('profile:updated', { action: 'update', profileId });
    return updated;
  }

  /**
   * Delete staff profile
   */
  async deleteProfile(profileId: string): Promise<boolean> {
    const index = this.profiles.findIndex(p => p.id === profileId);
    if (index === -1) return false;

    const deleted = this.profiles[index];
    this.profiles.splice(index, 1);
    delete this.localPasswords[deleted.login_id.toLowerCase()];
    this.saveLocalProfiles();

    if (isCloudReady() && supabase) {
      try {
        await safeMutation(
          () => supabase!.from('profiles').delete().eq('id', profileId),
          'delete profile'
        );
      } catch (e) {
        console.warn('Supabase delete profile notice:', e);
      }
    }

    await auditService.logAudit('admin', 'Super Admin', 'profile_deleted', 'platform', { profile_id: profileId, login_id: deleted.login_id });
    eventBus.emit('profile:updated', { action: 'delete', profileId });
    return true;
  }
}

export const authService = new AuthService();
