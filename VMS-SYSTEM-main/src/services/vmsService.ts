/**
 * VMS Service Facade — Backward-Compatible Service Unified API Layer
 * Re-exports domain-specific services (authService, directoryService, visitService,
 * securityService, auditService, eventBus) under the unified vmsService instance.
 *
 * Role hierarchy (3 roles):
 *   super_admin → platform-wide (Vidyavahini Group)
 *   branch_principal → per-branch / tenant admin
 *   receptionist → per-branch front desk
 */

import { College, Branch, Profile, Host, Visitor, Visit, BlacklistEntry, AuditLog, EmergencySosAlert, CollegeProvisioningResult } from '../types';
import { authService } from './authService';
import { directoryService } from './directoryService';
import { visitService } from './visitService';
import { securityService } from './securityService';
import { auditService } from './auditService';
import { notificationService } from './notificationService';
import { eventBus } from './eventBus';
import { supabase, isCloudReady } from './api/supabaseApi';
import { localDb } from '../offline/db';

class VmsService {
  // ─── EVENT BUS SUBSCRIBERS ───────────────────────────────────

  subscribe(listener: () => void): () => void {
    return eventBus.subscribe(listener);
  }

  subscribeToVisits(branchIdOrCb: any, cb?: () => void): () => void {
    const callback = typeof branchIdOrCb === 'function' ? branchIdOrCb : (cb || (() => {}));
    return eventBus.subscribe(callback);
  }

  // ─── AUTHENTICATION ──────────────────────────────────────────

  async login(loginId: string, password?: string): Promise<Profile | null> {
    return authService.login(loginId, password);
  }

  async logout(): Promise<void> {
    return authService.logout();
  }

  async changePassword(profileId: string): Promise<boolean> {
    return authService.changePassword(profileId);
  }

  // ─── CLOUD PHOTO STORAGE ──────────────────────────────────────

  async uploadVisitorPhoto(photoDataUrl: string, fileName?: string): Promise<string> {
    return visitService.uploadVisitorPhoto(photoDataUrl, fileName);
  }

  // ─── COLLEGES & BRANCHES ─────────────────────────────────────

  async getColleges(): Promise<College[]> {
    return directoryService.getColleges();
  }

  async getCollegeById(id: string): Promise<College | undefined> {
    return directoryService.getCollegeById(id);
  }

  async getBranches(collegeId?: string): Promise<Branch[]> {
    return directoryService.getBranches(collegeId);
  }

  async getBranchById(id: string): Promise<Branch | undefined> {
    return directoryService.getBranchById(id);
  }

  /**
   * Atomic college onboarding — creates college + branch + 2 accounts (Principal & Receptionist)
   */
  async onboardNewCollege(data: {
    collegeName: string;
    displayName: string;
    tagline?: string;
    logoUrl?: string;
    branchName: string;
    branchAddress: string;
    address?: string;
    contactPhone?: string;
    contactEmail?: string;
    principalPassword?: string;
    receptionistPassword?: string;
  }): Promise<CollegeProvisioningResult> {
    return directoryService.onboardNewCollege(data);
  }

  async toggleCollegeStatus(collegeId: string, status: 'active' | 'suspended'): Promise<void> {
    return directoryService.toggleCollegeStatus(collegeId, status);
  }

  async updateCollegeLogo(collegeId: string, logoUrl: string): Promise<void> {
    return directoryService.updateCollegeLogo(collegeId, logoUrl);
  }

  async deleteCollege(collegeId: string): Promise<boolean> {
    return directoryService.deleteCollege(collegeId);
  }

  async createBranch(collegeIdOrObj: any, name?: string, address?: string, maxVisitors?: number): Promise<Branch> {
    return directoryService.createBranch(collegeIdOrObj, name, address, maxVisitors);
  }

  async deleteBranch(branchId: string): Promise<boolean> {
    return directoryService.deleteBranch(branchId);
  }

  // ─── PROFILES & STAFF ────────────────────────────────────────

  async getProfilesByCollege(collegeId: string): Promise<Profile[]> {
    return directoryService.getProfilesByCollege(collegeId);
  }

  async getCollegeProfiles(collegeId: string): Promise<Profile[]> {
    return directoryService.getCollegeProfiles(collegeId);
  }

  async getBranchStaff(branchId: string): Promise<Profile[]> {
    return directoryService.getBranchStaff(branchId);
  }

  async createReceptionist(branchId: string, collegeId: string, loginId: string, fullName: string): Promise<Profile> {
    return directoryService.createReceptionist(branchId, collegeId, loginId, fullName);
  }

  async createBranchPrincipal(branchId: string, collegeId: string, loginId: string, fullName: string): Promise<Profile> {
    return directoryService.createBranchPrincipal(branchId, collegeId, loginId, fullName);
  }

  async createStaffAccount(data: any): Promise<Profile> {
    return directoryService.createStaffAccount(data);
  }

  async toggleAccountActive(profileId: string, isActive: boolean): Promise<void> {
    return directoryService.toggleAccountActive(profileId, isActive);
  }

  async toggleStaffStatus(profileId: string): Promise<Profile> {
    return directoryService.toggleStaffStatus(profileId);
  }

  async updateCollege(collegeId: string, updates: Partial<College>): Promise<College> {
    return directoryService.updateCollege(collegeId, updates);
  }

  async updateBranch(branchId: string, updates: Partial<Branch>): Promise<Branch> {
    return directoryService.updateBranch(branchId, updates);
  }

  async getCollegeAccountsWithCredentials(collegeId: string): Promise<Array<Profile & { password?: string; branchName?: string }>> {
    return directoryService.getCollegeAccountsWithCredentials(collegeId);
  }

  async getAllAccountsWithCredentials(): Promise<Array<Profile & { password?: string; collegeName?: string; branchName?: string }>> {
    return directoryService.getAllAccountsWithCredentials();
  }

  async adminSetUserPassword(profileId: string, newPassword: string): Promise<boolean> {
    return directoryService.adminSetUserPassword(profileId, newPassword);
  }

  async deleteUserAccount(profileId: string): Promise<boolean> {
    return directoryService.deleteUserAccount(profileId);
  }

  async updateUserAccount(profileId: string, updates: Partial<Profile>): Promise<Profile> {
    return directoryService.updateUserAccount(profileId, updates);
  }

  async resetStaffPassword(profileId: string): Promise<void> {
    return directoryService.resetStaffPassword(profileId);
  }

  // ─── HOST DIRECTORY ──────────────────────────────────────────

  async getHosts(branchId: string): Promise<Host[]> {
    return directoryService.getHosts(branchId);
  }

  async addHost(branchIdOrObj: any, name?: string, type?: 'staff' | 'student', department?: string): Promise<Host> {
    return directoryService.addHost(branchIdOrObj, name, type, department);
  }

  async importHostsFromCsv(branchId: string, csvText: string): Promise<{ importedCount: number; errors: string[] }> {
    return directoryService.importHostsFromCsv(branchId, csvText);
  }

  // ─── VISITORS & VISITS ───────────────────────────────────────

  async lookupVisitorByPhone(phone: string): Promise<Visitor | null> {
    return visitService.lookupVisitorByPhone(phone);
  }

  async createCheckIn(data: any): Promise<{ visit: Visit; isOffline: boolean }> {
    return visitService.createCheckIn(data);
  }

  async autoDispatchPassNotification(visit: Visit): Promise<void> {
    try {
      const passUrl = `${window.location.origin}/#/pass/${visit.qr_token || visit.id}`;
      await notificationService.dispatchPassSms(
        visit.visitor_phone || '',
        visit.visitor_name || 'Visitor',
        passUrl,
        'VMS'
      );
    } catch (e) {
      console.warn('Auto dispatch pass notification notice:', e);
    }
  }

  async processCheckOut(qrToken: string, branchId: string, rating?: number | null, feedbackComment?: string | null): Promise<{ visit: Visit; isOffline: boolean }> {
    return visitService.processCheckOut(qrToken, branchId, rating, feedbackComment);
  }

  async manualCheckOut(visitId: string, rating?: number | null, feedbackComment?: string | null): Promise<{ visit: Visit; isOffline: boolean }> {
    return visitService.manualCheckOut(visitId, rating, feedbackComment);
  }

  async getVisits(branchId?: string, collegeId?: string): Promise<Visit[]> {
    return visitService.getVisits(branchId, collegeId);
  }

  async clearVisits(branchId?: string): Promise<void> {
    return visitService.clearVisits(branchId);
  }

  // ─── PRE-REGISTRATION ─────────────────────────────────────────

  async getPreRegisteredVisits(branchId: string): Promise<Visit[]> {
    return visitService.getPreRegisteredVisits(branchId);
  }

  async checkInPreRegisteredVisit(visitId: string): Promise<Visit> {
    return visitService.checkInPreRegisteredVisit(visitId);
  }

  async addPreRegisteredVisit(visit: Visit): Promise<Visit> {
    return visitService.addPreRegisteredVisit(visit);
  }

  // ─── BLACKLIST MANAGEMENT ─────────────────────────────────────

  async checkBlacklist(phone: string, branchId: string, collegeId?: string): Promise<BlacklistEntry | null> {
    return securityService.checkBlacklist(phone, branchId, collegeId);
  }

  async getBlacklist(branchId?: string, collegeId?: string): Promise<BlacklistEntry[]> {
    return securityService.getBlacklist(branchId, collegeId);
  }

  async getCollegeBlacklist(collegeId: string): Promise<BlacklistEntry[]> {
    return securityService.getCollegeBlacklist(collegeId);
  }

  async addToBlacklist(entry: any): Promise<BlacklistEntry> {
    return securityService.addToBlacklist(entry);
  }

  async removeFromBlacklist(id: string): Promise<void> {
    return securityService.removeFromBlacklist(id);
  }

  async escalateBlacklistEntry(id: string): Promise<BlacklistEntry> {
    return securityService.escalateBlacklistEntry(id);
  }

  // ─── EMERGENCY SOS ALERTS ─────────────────────────────────────

  async raiseSosAlert(branchId: string, receptionistId: string, receptionistName: string, message: string, location?: string): Promise<EmergencySosAlert> {
    return securityService.raiseSosAlert(branchId, receptionistId, receptionistName, message, location);
  }

  async getActiveSosAlerts(branchId?: string): Promise<EmergencySosAlert[]> {
    return securityService.getActiveSosAlerts(branchId);
  }

  async dismissSosAlert(alertId: string): Promise<void> {
    return securityService.dismissSosAlert(alertId);
  }

  // ─── AUDIT LOGS & NOTIFICATIONS ───────────────────────────────

  async logAudit(actorId?: string, actorName?: string, action?: string, scope?: 'branch' | 'college' | 'platform', metadata?: any): Promise<void> {
    return auditService.logAudit(actorId, actorName, action, scope, metadata);
  }

  async getAuditLogs(collegeId?: string, branchId?: string): Promise<AuditLog[]> {
    return auditService.getAuditLogs(collegeId, branchId);
  }

  // ─── SYSTEM HEALTH & TELEMETRY MONITORING ───────────────────

  async getSystemHealthMetrics(): Promise<{
    stuckSyncCount: number;
    failedLogins24h: number;
    activeSosCount: number;
    cloudLatencyMs: number;
    cloudStatus: 'healthy' | 'degraded' | 'offline';
  }> {
    let cloudStatus: 'healthy' | 'degraded' | 'offline' = 'healthy';
    let cloudLatencyMs = 0;

    // 1. Test cloud ping latency
    if (isCloudReady() && supabase) {
      try {
        const pingStart = Date.now();
        await supabase.from('colleges').select('id').limit(1);
        cloudLatencyMs = Date.now() - pingStart;
        if (cloudLatencyMs > 1500) cloudStatus = 'degraded';
      } catch (e) {
        cloudStatus = 'offline';
      }
    } else {
      cloudStatus = 'offline';
    }

    // 2. Count stuck offline sync items (> 1 hour)
    let stuckSyncCount = 0;
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const pendingQueue = await localDb.sync_queue.filter(
        item => item.status === 'pending' || item.status === 'failed'
      ).toArray();
      stuckSyncCount = pendingQueue.filter(item => item.created_at < oneHourAgo).length;

      const localVisits = await localDb.local_visits.toArray();
      const unsyncedVisits = localVisits.filter(
        v => (!v.synced_at || v.synced_at === '') && v.created_at && v.created_at < oneHourAgo
      );
      stuckSyncCount += unsyncedVisits.length;
    } catch (e) { /* silent */ }

    // 3. Count failed logins in last 24h
    let failedLogins24h = 0;
    try {
      const logs = await auditService.getAuditLogs();
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      failedLogins24h = logs.filter(
        l => l.action === 'login_failed' && l.created_at >= twentyFourHoursAgo
      ).length;
    } catch (e) { /* silent */ }

    // 4. Count active SOS alerts
    let activeSosCount = 0;
    try {
      const sosList = await securityService.getActiveSosAlerts();
      activeSosCount = sosList.length;
    } catch (e) { /* silent */ }

    return {
      stuckSyncCount,
      failedLogins24h,
      activeSosCount,
      cloudLatencyMs,
      cloudStatus
    };
  }
}

export const vmsService = new VmsService();
