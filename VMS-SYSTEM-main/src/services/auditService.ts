/**
 * VMS Audit Service — Centralized multi-tenant audit logging with tenant isolation
 */

import { AuditLog } from '../types';
import { supabase, isCloudReady, safeMutation } from './api/supabaseApi';

class AuditService {
  private auditLogs: AuditLog[] = [];

  /**
   * Log an audit event with tenant college_id and branch_id context
   */
  async logAudit(
    actorId?: string,
    actorName?: string,
    action?: string,
    scope?: 'branch' | 'college' | 'platform',
    metadata?: Record<string, any>
  ): Promise<void> {
    const log: AuditLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      actor_id: actorId,
      actor_name: actorName || 'System User',
      action: action || 'unknown_action',
      scope: scope || 'branch',
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
          metadata: log.metadata || null,
          created_at: log.created_at
        }),
        'insert audit log'
      );
    }
  }

  /**
   * Get audit logs filtered by tenant college_id or branch_id for complete data isolation
   */
  async getAuditLogs(collegeId?: string, branchId?: string): Promise<AuditLog[]> {
    let logs = this.auditLogs;

    if (collegeId) {
      logs = logs.filter(l => {
        const meta = l.metadata || {};
        return (
          meta.college_id === collegeId ||
          meta.collegeId === collegeId ||
          l.scope === 'platform' || // Platform events visible if applicable
          (meta.branch_id && branchId && meta.branch_id === branchId)
        );
      });
    }

    if (branchId) {
      logs = logs.filter(l => {
        const meta = l.metadata || {};
        return meta.branch_id === branchId || meta.branchId === branchId;
      });
    }

    return logs;
  }

  /**
   * Initialize with existing logs
   */
  setLogs(logs: AuditLog[]): void {
    this.auditLogs = logs;
  }
}

export const auditService = new AuditService();
