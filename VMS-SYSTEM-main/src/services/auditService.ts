/**
 * VMS Audit Service — Centralized multi-tenant audit logging with tenant isolation.
 * Every write is auto-stamped with the active session's college_id/branch_id so
 * per-tenant audit views work without relying on free-form metadata keys.
 */

import { AuditLog, Profile } from '../types';
import { supabase, isCloudReady, safeQuery, safeMutation } from './api/supabaseApi';

class AuditService {
  private auditLogs: AuditLog[] = [];

  /** Resolve the signed-in profile for tenant stamping (localStorage session) */
  private getActiveProfile(): Profile | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem('vms_active_profile');
        if (saved) return JSON.parse(saved) as Profile;
      }
    } catch (e) { /* silent */ }
    return null;
  }

  /**
   * Log an audit event. Tenant columns are stamped automatically from the
   * active session profile — callers never need to pass them explicitly.
   */
  async logAudit(
    actorId?: string,
    actorName?: string,
    action?: string,
    scope?: 'branch' | 'college' | 'platform',
    metadata?: Record<string, any>
  ): Promise<void> {
    const profile = this.getActiveProfile();
    const log: AuditLog = {
      id: crypto.randomUUID(),
      actor_id: actorId || profile?.id,
      actor_name: actorName || profile?.full_name || 'System User',
      action: action || 'unknown_action',
      scope: scope || 'branch',
      college_id: profile?.college_id || null,
      branch_id: profile?.branch_id || null,
      metadata: metadata || {},
      created_at: new Date().toISOString()
    };
    this.auditLogs.unshift(log);

    // Persist to cloud if available
    if (isCloudReady() && supabase) {
      await safeMutation(
        () => supabase!.from('audit_logs').insert({
          id: log.id,
          actor_id: log.actor_id || null,
          actor_name: log.actor_name,
          action: log.action,
          scope: log.scope,
          college_id: log.college_id,
          branch_id: log.branch_id,
          metadata: log.metadata || null,
          created_at: log.created_at
        }),
        'insert audit log'
      );
    }
  }

  /**
   * Get audit logs filtered by tenant college_id or branch_id.
   * Cloud-first: fetches persisted logs from Supabase (RLS enforces visibility),
   * merges with in-memory session logs, then filters using the real tenant columns
   * with a metadata fallback for legacy rows.
   */
  async getAuditLogs(collegeId?: string, branchId?: string): Promise<AuditLog[]> {
    let logs = [...this.auditLogs];

    if (isCloudReady() && supabase) {
      const { data } = await safeQuery<AuditLog[]>(
        () => supabase!.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500),
        'getAuditLogs'
      );
      if (data) {
        const byId = new Map(logs.map(l => [l.id, l]));
        (data as AuditLog[]).forEach(cloudLog => byId.set(cloudLog.id, cloudLog));
        logs = Array.from(byId.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
    }

    const matchesTenant = (l: AuditLog): boolean => {
      const meta = l.metadata || {};
      if (collegeId) {
        if (l.college_id === collegeId || meta.college_id === collegeId || meta.collegeId === collegeId) return true;
        if (branchId && (l.branch_id === branchId || meta.branch_id === branchId || meta.branchId === branchId)) return true;
        // Platform-scope events are only visible when no tenant filter is applied
        return false;
      }
      if (branchId) {
        return l.branch_id === branchId || meta.branch_id === branchId || meta.branchId === branchId;
      }
      return true; // no filter — platform owner sees everything RLS allows
    };

    return logs.filter(matchesTenant);
  }

  /**
   * Initialize with existing logs
   */
  setLogs(logs: AuditLog[]): void {
    this.auditLogs = logs;
  }
}

export const auditService = new AuditService();
