/**
 * VMS Security Service — Blacklist management
 */

import { BlacklistEntry } from '../types';
import { supabase, isCloudReady, safeQuery, safeMutation } from './api/supabaseApi';
import { localDb } from '../offline/db';
import { auditService } from './auditService';
import { eventBus } from './eventBus';
import { INITIAL_BLACKLIST } from './mockData';

class SecurityService {
  private blacklist: BlacklistEntry[] = [];

  constructor() {
    this.setupSupabaseRealtime();
    // Rehydrate blacklist from IndexedDB cache + cloud so the gate survives restarts
    void this.rehydrateBlacklist();
  }

  private setupSupabaseRealtime(): void {
    if (isCloudReady() && supabase) {
      try {
        supabase
          .channel('vms-realtime-security')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'blacklist' }, () => {
            void this.rehydrateBlacklist();
            eventBus.emit('blacklist:updated');
            eventBus.emit('data:changed');
          })
          .subscribe();
      } catch (e) {
        console.warn('Supabase realtime security subscription notice:', e);
      }
    }
  }

  // ─── BLACKLIST ────────────────────────────────────────────────

  /** Normalize any phone format ('+91 98765 43210', '9876543210', etc.) to last 10 digits */
  private normalizePhone(p: string): string {
    return (p || '').replace(/\D/g, '').slice(-10);
  }

  /**
   * Rebuild the in-memory blacklist gate from (1) local IndexedDB cache and
   * (2) the Supabase cloud when reachable. Guarantees protection survives restarts.
   */
  private async rehydrateBlacklist(): Promise<void> {
    // 1. Local cache first — works with zero network
    try {
      const localEntries = await localDb.local_blacklist.toArray();
      const byId = new Map(this.blacklist.map(b => [b.id, b]));
      localEntries.forEach(e => byId.set(e.id, e));
      this.blacklist = Array.from(byId.values());
    } catch (e) { /* silent */ }

    // 2. Cloud refresh when available
    if (isCloudReady() && supabase) {
      try {
        const { data, error } = await supabase.from('blacklist').select('*');
        if (!error && data) {
          const byId = new Map(this.blacklist.map(b => [b.id, b]));
          (data as BlacklistEntry[]).forEach(cloudEntry => {
            byId.set(cloudEntry.id, cloudEntry);
            localDb.local_blacklist.put(cloudEntry).catch(() => {});
          });
          this.blacklist = Array.from(byId.values());
          eventBus.emit('data:changed');
        }
      } catch (e) {
        console.warn('Blacklist cloud rehydration notice:', e);
      }
    }
  }

  async checkBlacklist(phone: string, branchId: string, collegeId?: string): Promise<BlacklistEntry | null> {
    const target = this.normalizePhone(phone);
    if (!target) return null;
    const entry = this.blacklist.find(b =>
      this.normalizePhone(b.visitor_phone) === target &&
      (b.branch_id === branchId ||
       (!!collegeId && b.college_id === collegeId) ||
       b.scope === 'college')
    );
    return entry || null;
  }

  async getBlacklist(branchId?: string, collegeId?: string): Promise<BlacklistEntry[]> {
    // Ensure memory reflects local cache + cloud before filtering
    if (this.blacklist.length === 0) {
      await this.rehydrateBlacklist();
    }
    return this.blacklist.filter(b =>
      (branchId && b.branch_id === branchId) ||
      (collegeId && b.college_id === collegeId)
    );
  }

  async getCollegeBlacklist(collegeId: string): Promise<BlacklistEntry[]> {
    return this.getBlacklist(undefined, collegeId);
  }

  async addToBlacklist(entry: {
    scope: 'branch' | 'college';
    branchId?: string;
    branch_id?: string;
    collegeId?: string;
    college_id?: string;
    visitorPhone?: string;
    visitor_phone?: string;
    reason: string;
    createdBy?: string;
    added_by_profile_id?: string;
  }): Promise<BlacklistEntry> {
    const branchId = entry.branchId || entry.branch_id || null;
    const collegeId = entry.collegeId || entry.college_id || null;
    const phone = (entry.visitorPhone || entry.visitor_phone || '').trim();
    const createdBy = entry.createdBy || entry.added_by_profile_id;

    const newEntry: BlacklistEntry = {
      id: crypto.randomUUID(),
      scope: entry.scope,
      branch_id: branchId,
      college_id: collegeId,
      visitor_phone: phone,
      reason: entry.reason,
      created_by: createdBy,
      created_at: new Date().toISOString()
    };
    this.blacklist.push(newEntry);
    await localDb.local_blacklist.put(newEntry);

    // Push to cloud immediately when possible; otherwise enqueue for the offline sync engine
    let pushed = false;
    if (isCloudReady() && supabase) {
      const res = await safeMutation(
        () => supabase!.from('blacklist').upsert({
          id: newEntry.id,
          scope: newEntry.scope,
          branch_id: newEntry.branch_id,
          college_id: newEntry.college_id,
          visitor_phone: newEntry.visitor_phone,
          reason: newEntry.reason,
          created_by: newEntry.created_by || null,
          escalated_to_college: !!newEntry.escalated_to_college,
          created_at: newEntry.created_at
        }),
        'add blacklist entry'
      );
      pushed = res;
    }
    if (!pushed) {
      try {
        const { syncEngine } = await import('../offline/syncEngine');
        await localDb.sync_queue.put({
          id: `blacklist-${newEntry.id}`,
          type: 'add_blacklist',
          payload: { entry: newEntry },
          status: 'pending',
          retry_count: 0,
          created_at: new Date().toISOString()
        });
        syncEngine.triggerSync();
      } catch (e) { /* silent */ }
    }

    await auditService.logAudit(createdBy, 'Admin', 'add_to_blacklist', entry.scope, { phone, reason: entry.reason });
    eventBus.emit('blacklist:updated', { action: 'add', phone });
    return newEntry;
  }

  async removeFromBlacklist(id: string): Promise<void> {
    this.blacklist = this.blacklist.filter(b => b.id !== id);
    await localDb.local_blacklist.delete(id);
    if (isCloudReady() && supabase) {
      await safeMutation(
        () => supabase!.from('blacklist').delete().eq('id', id),
        'remove blacklist entry'
      );
    }
    eventBus.emit('blacklist:updated', { action: 'remove', id });
  }

  async escalateBlacklistEntry(id: string): Promise<BlacklistEntry> {
    const entry = this.blacklist.find(b => b.id === id);
    if (!entry) throw new Error("Blacklist entry not found");
    entry.scope = 'college';
    entry.escalated_to_college = true;
    await localDb.local_blacklist.put(entry);
    if (isCloudReady() && supabase) {
      await safeMutation(
        () => supabase!.from('blacklist').update({ scope: 'college', escalated_to_college: true }).eq('id', id),
        'escalate blacklist entry'
      );
    }
    await auditService.logAudit(undefined, 'Branch Principal', 'escalate_blacklist', 'college', { entry_id: id });
    eventBus.emit('blacklist:updated', { action: 'escalate', id });
    return entry;
  }

  // ─── STATE ACCESS ────────────────────────────────────────────

  getBlacklistArray(): BlacklistEntry[] {
    return this.blacklist;
  }

  setBlacklist(entries: BlacklistEntry[]): void {
    this.blacklist = entries;
  }
}

export const securityService = new SecurityService();
