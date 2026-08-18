/**
 * VMS Security Service — Blacklist & Emergency SOS management
 */

import { BlacklistEntry, EmergencySosAlert } from '../types';
import { supabase, isCloudReady, safeQuery, safeMutation } from './api/supabaseApi';
import { localDb } from '../offline/db';
import { auditService } from './auditService';
import { eventBus } from './eventBus';
import { INITIAL_BLACKLIST } from './mockData';

class SecurityService {
  private blacklist: BlacklistEntry[] = [];
  private sosAlerts: EmergencySosAlert[] = [];
  private sosBroadcastChannel: BroadcastChannel | null = null;

  constructor() {
    this.initBroadcastChannel();
    this.loadSosAlerts();
    this.setupSosSync();
    this.setupSupabaseRealtime();
  }

  private setupSupabaseRealtime(): void {
    if (isCloudReady() && supabase) {
      try {
        supabase
          .channel('vms-realtime-security')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_sos_alerts' }, () => {
            this.getActiveSosAlerts().then(() => {
              eventBus.emit('sos:raised');
              eventBus.emit('data:changed');
            });
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'blacklist' }, () => {
            eventBus.emit('blacklist:updated');
            eventBus.emit('data:changed');
          })
          .subscribe();
      } catch (e) {
        console.warn('Supabase realtime security subscription notice:', e);
      }
    }
  }

  private initBroadcastChannel(): void {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.sosBroadcastChannel = new BroadcastChannel('vimtech_vms_sos_channel');
      } catch (e) {
        console.warn('BroadcastChannel initialization error:', e);
      }
    }
  }

  // ─── SOS INTERNAL SYNC ────────────────────────────────────────

  private loadSosAlerts(): void {
    try {
      const stored = localStorage.getItem('vimtech_vms_sos_alerts');
      if (stored) {
        this.sosAlerts = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load SOS alerts from localStorage:', e);
    }
  }

  private saveSosAlerts(): void {
    try {
      localStorage.setItem('vimtech_vms_sos_alerts', JSON.stringify(this.sosAlerts));
      if (this.sosBroadcastChannel) {
        try {
          this.sosBroadcastChannel.postMessage({ type: 'SOS_UPDATED', timestamp: Date.now() });
        } catch (e) { /* silent */ }
      }
    } catch (e) {
      console.warn('Failed to save SOS alerts to localStorage:', e);
    }
  }

  private setupSosSync(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('storage', (e) => {
      if (e.key === 'vimtech_vms_sos_alerts') {
        this.loadSosAlerts();
        eventBus.emit('sos:raised');
        eventBus.emit('data:changed');
      }
    });
    if (this.sosBroadcastChannel) {
      this.sosBroadcastChannel.onmessage = () => {
        this.loadSosAlerts();
        eventBus.emit('sos:raised');
        eventBus.emit('data:changed');
      };
    }
  }

  // ─── BLACKLIST ────────────────────────────────────────────────

  async checkBlacklist(phone: string, branchId: string, collegeId?: string): Promise<BlacklistEntry | null> {
    const cleanPhone = phone.trim();
    const entry = this.blacklist.find(b =>
      b.visitor_phone === cleanPhone &&
      (b.branch_id === branchId || (collegeId && b.college_id === collegeId))
    );
    return entry || null;
  }

  async getBlacklist(branchId?: string, collegeId?: string): Promise<BlacklistEntry[]> {
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
      id: `blk-${Date.now()}`,
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
    await auditService.logAudit(createdBy, 'Admin', 'add_to_blacklist', entry.scope, { phone, reason: entry.reason });
    eventBus.emit('blacklist:updated', { action: 'add', phone });
    return newEntry;
  }

  async removeFromBlacklist(id: string): Promise<void> {
    this.blacklist = this.blacklist.filter(b => b.id !== id);
    await localDb.local_blacklist.delete(id);
    eventBus.emit('blacklist:updated', { action: 'remove', id });
  }

  async escalateBlacklistEntry(id: string): Promise<BlacklistEntry> {
    const entry = this.blacklist.find(b => b.id === id);
    if (!entry) throw new Error("Blacklist entry not found");
    entry.scope = 'college';
    entry.escalated_to_college = true;
    await localDb.local_blacklist.put(entry);
    await auditService.logAudit('usr-vimtech-principal', 'Branch Principal', 'escalate_blacklist', 'college', { entry_id: id });
    eventBus.emit('blacklist:updated', { action: 'escalate', id });
    return entry;
  }

  // ─── EMERGENCY SOS ALERTS ────────────────────────────────────

  async raiseSosAlert(branchId: string, receptionistId: string, receptionistName: string, message: string, branchName?: string): Promise<EmergencySosAlert> {
    const alert: EmergencySosAlert = {
      id: `sos-${Date.now()}`,
      branch_id: branchId || '22222222-2222-2222-2222-222222222222',
      branch_name: branchName || 'Main Campus',
      receptionist_id: receptionistId || 'usr-reception',
      receptionist_name: receptionistName || 'Front Desk Duty Officer',
      message: message || 'Urgent assistance requested at front desk.',
      created_at: new Date().toISOString(),
      is_active: true
    };
    this.sosAlerts.unshift(alert);
    this.saveSosAlerts();

    if (isCloudReady() && supabase) {
      await safeMutation(
        () => supabase!.from('emergency_sos_alerts').insert({
          id: alert.id,
          branch_id: alert.branch_id,
          branch_name: alert.branch_name,
          receptionist_id: alert.receptionist_id || null,
          receptionist_name: alert.receptionist_name,
          message: alert.message,
          is_active: true,
          created_at: alert.created_at
        }),
        'insert SOS alert'
      );
    }

    await auditService.logAudit(receptionistId, receptionistName, 'raise_emergency_sos', 'branch', { branch_id: branchId, message });
    eventBus.emit('sos:raised', { alertId: alert.id, branchId });
    eventBus.emit('data:changed');
    return alert;
  }

  async getActiveSosAlerts(branchId?: string): Promise<EmergencySosAlert[]> {
    this.loadSosAlerts();
    if (isCloudReady() && supabase) {
      try {
        let query = supabase.from('emergency_sos_alerts').select('*').eq('is_active', true).order('created_at', { ascending: false });
        if (branchId) {
          query = query.eq('branch_id', branchId);
        }
        const { data, error } = await query;
        if (data && !error && data.length > 0) {
          const cloudAlerts = data as EmergencySosAlert[];
          cloudAlerts.forEach(ca => {
            const idx = this.sosAlerts.findIndex(a => a.id === ca.id);
            if (idx !== -1) this.sosAlerts[idx] = ca;
            else this.sosAlerts.push(ca);
          });
          this.saveSosAlerts();
        }
      } catch (e) {
        console.warn('Supabase getActiveSosAlerts fallback:', e);
      }
    }
    return this.sosAlerts.filter(a => a.is_active && (!branchId || a.branch_id === branchId || !a.branch_id));
  }

  async dismissSosAlert(alertId: string): Promise<void> {
    const alert = this.sosAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.is_active = false;
    }
    // Also mark active in array
    this.sosAlerts = this.sosAlerts.map(a => a.id === alertId ? { ...a, is_active: false } : a);
    this.saveSosAlerts();

    if (isCloudReady() && supabase) {
      await safeMutation(
        () => supabase!.from('emergency_sos_alerts').update({ is_active: false }).eq('id', alertId),
        'dismiss SOS alert'
      );
    }

    eventBus.emit('sos:dismissed', { alertId });
    eventBus.emit('data:changed');
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
