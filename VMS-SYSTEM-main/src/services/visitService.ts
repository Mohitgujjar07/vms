/**
 * VMS Visit Service — Visitor & Visit lifecycle domain service
 * Handles visitor check-in, camera photo uploads, deduplication locks,
 * QR pass creation/validation, check-out, pre-registration, and visit queries.
 */

import { Visit, Visitor } from '../types';
import { supabase, isCloudReady, safeMutation } from './api/supabaseApi';
import { localDb } from '../offline/db';
import { syncEngine } from '../offline/syncEngine';
import { auditService } from './auditService';
import { directoryService } from './directoryService';
import { securityService } from './securityService';
import { eventBus } from './eventBus';
import { INITIAL_VISITORS, INITIAL_VISITS } from './mockData';

class VisitService {
  private visitors: Visitor[] = [...INITIAL_VISITORS];
  private visits: Visit[] = [...INITIAL_VISITS];

  constructor() {
    this.seedLocalDb();
    this.setupSupabaseRealtime();
  }

  private setupSupabaseRealtime(): void {
    if (isCloudReady() && supabase) {
      try {
        supabase
          .channel('vms-realtime-visits')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => {
            this.getVisits().then(() => eventBus.emit('visit:created'));
          })
          .subscribe();
      } catch (e) {
        console.warn('Supabase realtime subscription notice:', e);
      }
    }
  }

  private async seedLocalDb(): Promise<void> {
    try {
      const count = await localDb.local_visits.count();
      if (count === 0) {
        await localDb.local_visits.bulkPut(this.visits);
        await localDb.local_visitors.bulkPut(this.visitors);
      } else {
        const dbVisitors = await localDb.local_visitors.toArray();
        if (dbVisitors && dbVisitors.length > 0) {
          const vMap = new Map(this.visitors.map(v => [v.id, v]));
          dbVisitors.forEach(v => vMap.set(v.id, v));
          this.visitors = Array.from(vMap.values());
        }

        const dbVisits = await localDb.local_visits.toArray();
        if (dbVisits && dbVisits.length > 0) {
          const map = new Map(this.visits.map(v => [v.id, v]));
          const vMap = new Map(this.visitors.map(v => [v.id, v]));

          dbVisits.forEach(v => {
            // Heal any missing visitor name/phone using visitor lookup
            if ((!v.visitor_name || !v.visitor_phone) && v.visitor_id && vMap.has(v.visitor_id)) {
              const matched = vMap.get(v.visitor_id)!;
              v.visitor_name = v.visitor_name || matched.name;
              v.visitor_phone = v.visitor_phone || matched.phone;
            }
            map.set(v.id, { ...(map.get(v.id) || {}), ...v });
          });
          this.visits = Array.from(map.values()).sort(
            (a, b) => new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime()
          );
        }
      }
    } catch (e) {
      console.warn('LocalDB seed notification:', e);
    }
  }

  // ─── VISITOR LOOKUP ──────────────────────────────────────────

  async lookupVisitorByPhone(phone: string): Promise<Visitor | null> {
    const cleanPhone = phone.trim();
    let found = this.visitors.find(v => v.phone === cleanPhone);
    if (!found) {
      found = await localDb.local_visitors.where('phone').equals(cleanPhone).first();
    }
    return found || null;
  }

  // ─── CHECK-IN & CHECK-OUT ─────────────────────────────────────

  async createCheckIn(data: {
    branchId: string;
    collegeId?: string;
    receptionistId?: string;
    receptionistName?: string;
    visitorName: string;
    visitorPhone: string;
    visitorPhotoUrl?: string;
    hostId?: string;
    purpose: string;
  }): Promise<{ visit: Visit; isOffline: boolean }> {
    const { branchId, receptionistId, visitorPhotoUrl, hostId } = data;

    // 0. INPUT SANITIZATION & NORMALIZATION
    const cleanPhone = (data.visitorPhone || '').replace(/[^\d+]/g, '').trim();
    const cleanName = (data.visitorName || '').replace(/[<>&"'/]/g, '').trim();
    const cleanPurpose = (data.purpose || 'Campus Visit').replace(/[<>&"'/]/g, '').trim();

    if (!cleanPhone || cleanPhone.length < 5) {
      throw new Error('Please provide a valid visitor phone number.');
    }
    if (!cleanName) {
      throw new Error('Please provide a valid visitor name.');
    }

    // 1. BLACKLIST SECURITY GATEKEEPER CHECK (Core Policy)
    const blacklisted = await securityService.checkBlacklist(cleanPhone, branchId, data.collegeId);
    if (blacklisted) {
      await auditService.logAudit(
        receptionistId || 'front_desk',
        data.receptionistName || 'Front Desk Gatekeeper',
        'blocked_blacklisted_checkin',
        'branch',
        { visitor_phone: cleanPhone, visitor_name: cleanName, reason: blacklisted.reason, branch_id: branchId }
      );
      throw new Error(`SECURITY ALERT: Visitor (${cleanName} - ${cleanPhone}) is blacklisted at this campus. Reason: ${blacklisted.reason}`);
    }

    // 2. DEDUPLICATION CHECK (On-Device Local Lock)
    const activeVisit = await syncEngine.checkVisitorIsCurrentlyInside(branchId, cleanPhone);
    if (activeVisit) {
      await auditService.logAudit(
        receptionistId || 'front_desk',
        data.receptionistName || 'Front Desk Gatekeeper',
        'duplicate_checkin_blocked',
        'branch',
        { visitor_phone: cleanPhone, visitor_name: cleanName, branch_id: branchId }
      );
      throw new Error(`This visitor (${cleanName} - ${cleanPhone}) is already checked in. Check them out first if this is a mistake.`);
    }

    // 3. PHOTO POLICY: captured photos are EPHEMERAL by design.
    // They live only in React state for the instant printable pass and are
    // NEVER uploaded to storage, written to the database, or cached in IndexedDB.

    // 4. Visitor profile lookup or registration (photo_url intentionally left empty)
    let visitor = await this.lookupVisitorByPhone(cleanPhone);
    if (!visitor) {
      visitor = {
        id: crypto.randomUUID(),
        name: cleanName,
        phone: cleanPhone,
        created_at: new Date().toISOString()
      };
      this.visitors.push(visitor);
    }

    // Host selection removed from the check-in flow — host fields are optional
    // legacy metadata only (populated when a visit still carries one).
    const host = hostId ? directoryService.findHost(hostId) : undefined;

    // 5. Generate dynamic tenant QR token
    const br = directoryService.getBranchesArray().find(b => b.id === branchId);
    const col = br?.college_id ? directoryService.getCollegesArray().find(c => c.id === br.college_id) : undefined;
    const collegeTag = (col?.display_name || 'CAMPUS').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const qrToken = `VMS-${collegeTag}-${randomCode}-${Date.now().toString().slice(-4)}`;

    const expiry = new Date();
    expiry.setHours(23, 59, 59, 999);

    const visit: Visit = {
      id: crypto.randomUUID(),
      visitor_id: visitor.id,
      branch_id: branchId,
      host_id: hostId || null,
      purpose: cleanPurpose,
      status: 'inside',
      qr_token: qrToken,
      qr_expires_at: expiry.toISOString(),
      qr_used: false,
      check_in_time: new Date().toISOString(),
      created_by: receptionistId,
      created_at: new Date().toISOString(),
      visitor_name: visitor.name,
      visitor_phone: visitor.phone,
      // Persisted record carries NO photo (ephemeral-by-design policy)
      host_name: host?.name || '',
      host_department: host?.department_or_class || '',
      sync_status: navigator.onLine ? 'synced' : 'pending'
    };

    this.visits.unshift(visit);

    // 6. Queue IndexedDB persistence & cloud sync (photo-free payload)
    const result = await syncEngine.queueCheckIn(visit, visitor);

    await auditService.logAudit(receptionistId, data.receptionistName, 'visit_created', 'branch', {
      visitor_name: cleanName,
      visitor_phone: cleanPhone,
      qr_token: qrToken
    });

    eventBus.emit('visit:created', { visitId: visit.id, branchId });

    // 7. Attach the captured photo ONLY to the returned copy — used exclusively by
    // the pass UI during this session. It is never queued, synced, or persisted.
    const enrichedVisit: Visit = visitorPhotoUrl
      ? { ...result.visit, visitor_photo_url: visitorPhotoUrl }
      : result.visit;

    return { visit: enrichedVisit, isOffline: result.isOffline };
  }

  async processCheckOut(qrToken: string, branchId: string, rating?: number | null, feedbackComment?: string | null): Promise<{ visit: Visit; isOffline: boolean }> {
    const cleanToken = qrToken.trim().toLowerCase();
    let visit = this.visits.find(v => v.qr_token.toLowerCase() === cleanToken || v.qr_token === qrToken.trim());

    if (!visit) {
      try {
        const dbMatch = await localDb.local_visits.where('qr_token').equals(qrToken.trim()).first()
          || await localDb.local_visits.filter(v => v.qr_token.toLowerCase() === cleanToken).first();
        if (dbMatch) {
          visit = dbMatch;
          this.visits.unshift(visit);
        }
      } catch (e) { /* silent */ }
    }

    if (!visit) {
      throw new Error('Invalid QR Code. No matching visit record found.');
    }

    if (visit.branch_id !== branchId) {
      throw new Error('This QR Code belongs to a different branch/campus.');
    }

    if (visit.status === 'checked_out' || visit.qr_used) {
      throw new Error('This visitor QR code has already been scanned and checked out.');
    }

    const checkOutTime = new Date().toISOString();
    visit.status = 'checked_out';
    visit.qr_used = true;
    visit.check_out_time = checkOutTime;
    if (rating !== undefined) visit.rating = rating;
    if (feedbackComment !== undefined) visit.feedback_comment = feedbackComment;

    const result = await syncEngine.queueCheckOut(visit.id, checkOutTime, visit, rating, feedbackComment);
    await auditService.logAudit('receptionist', 'Receptionist', 'visit_checked_out', 'branch', {
      visit_id: visit.id,
      qr_token: qrToken,
      rating,
      feedback_comment: feedbackComment
    });

    eventBus.emit('visit:checked_out', { visitId: visit.id, branchId });
    return { visit, isOffline: result.isOffline };
  }

  async manualCheckOut(visitId: string, rating?: number | null, feedbackComment?: string | null): Promise<{ visit: Visit; isOffline: boolean }> {
    let visit = this.visits.find(v => v.id === visitId);
    
    if (!visit) {
      try {
        const local = await localDb.local_visits.get(visitId);
        if (local) {
          visit = local;
          this.visits.unshift(visit);
        }
      } catch (e) { /* silent */ }
    }

    if (!visit && isCloudReady() && supabase) {
      try {
        const { data } = await supabase.from('visits').select('*').eq('id', visitId).single();
        if (data) {
          visit = data as Visit;
          this.visits.unshift(visit);
        }
      } catch (e) { /* silent */ }
    }

    if (!visit) {
      throw new Error('Visit record not found. Please refresh the log and try again.');
    }

    const checkOutTime = new Date().toISOString();
    visit.status = 'checked_out';
    visit.qr_used = true;
    visit.check_out_time = checkOutTime;
    if (rating !== undefined && rating !== null) visit.rating = rating;
    if (feedbackComment !== undefined && feedbackComment !== null) visit.feedback_comment = feedbackComment;

    const result = await syncEngine.queueCheckOut(visit.id, checkOutTime, visit, rating, feedbackComment);
    await auditService.logAudit('receptionist', 'Receptionist', 'visit_checked_out', 'branch', {
      visit_id: visit.id,
      rating: rating || 5,
      feedback_comment: feedbackComment || ''
    });

    eventBus.emit('visit:checked_out', { visitId: visit.id, branchId: visit.branch_id });
    return { visit, isOffline: result.isOffline };
  }

  // ─── QUERY VISITS ─────────────────────────────────────────────

  async getVisits(branchId?: string, collegeId?: string): Promise<Visit[]> {
    if (isCloudReady() && supabase) {
      try {
        // Fetch cloud visitors to keep visitor directory updated
        const { data: vData } = await supabase.from('visitors').select('*');
        if (vData) {
          const vMap = new Map<string, Visitor>();
          vData.forEach((v: Visitor) => vMap.set(v.id, v));
          this.visitors = Array.from(vMap.values());
          try {
            await localDb.local_visitors.clear();
            await localDb.local_visitors.bulkPut(vData);
          } catch (e) { /* silent */ }
        }

        let query = supabase
          .from('visits')
          .select('*, visitors(id, name, phone, photo_url), hosts(id, name, department_or_class)')
          .order('check_in_time', { ascending: false });
        if (branchId) {
          query = query.eq('branch_id', branchId);
        }
        const { data, error } = await query;
        if (data && !error) {
          const visitorMap = new Map(this.visitors.map(v => [v.id, v]));
          const cloudVisits: Visit[] = data.map((row: any) => {
            const visitorObj = row.visitors || (row.visitor_id ? visitorMap.get(row.visitor_id) : undefined);
            const hostObj = row.hosts;
            const visit: Visit = {
              ...row,
              visitor_name: visitorObj?.name || row.visitor_name || '',
              visitor_phone: visitorObj?.phone || row.visitor_phone || '',
              visitor_photo_url: visitorObj?.photo_url || row.visitor_photo_url || '',
              host_name: hostObj?.name || row.host_name || '',
              host_department: hostObj?.department_or_class || row.host_department || ''
            };
            return visit;
          });

          const cloudIds = new Set(cloudVisits.map(cv => cv.id));
          if (!branchId && !collegeId) {
            this.visits = cloudVisits;
            try {
              const pendingVisits = await localDb.local_visits.filter(v => v.sync_status === 'pending').toArray();
              await localDb.local_visits.clear();
              await localDb.local_visits.bulkPut([...cloudVisits, ...pendingVisits]);
            } catch (e) { /* silent */ }
          } else {
            this.visits = [
              ...this.visits.filter(v => branchId ? v.branch_id !== branchId : !cloudIds.has(v.id)),
              ...cloudVisits
            ].sort((a, b) => new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime());

            try {
              if (branchId) {
                const pendingBranchVisits = await localDb.local_visits
                  .where('branch_id').equals(branchId)
                  .filter(v => v.sync_status === 'pending')
                  .toArray();
                const oldBranchVisits = await localDb.local_visits.where('branch_id').equals(branchId).toArray();
                await localDb.local_visits.bulkDelete(oldBranchVisits.map(v => v.id));
                await localDb.local_visits.bulkPut([...cloudVisits, ...pendingBranchVisits]);
              }
            } catch (e) { /* silent */ }
          }
        }
      } catch (e) {
        console.warn('Supabase getVisits fallback:', e);
      }
    }

    try {
      const dbVisitors = await localDb.local_visitors.toArray();
      const visitorMap = new Map(this.visitors.map(v => [v.id, v]));
      if (dbVisitors && dbVisitors.length > 0) {
        dbVisitors.forEach(v => visitorMap.set(v.id, v));
        this.visitors = Array.from(visitorMap.values());
      }

      const dbVisits = await localDb.local_visits.toArray();
      if (dbVisits && dbVisits.length > 0) {
        const map = new Map(this.visits.map(v => [v.id, v]));
        dbVisits.forEach(local => {
          if ((!local.visitor_name || !local.visitor_phone) && local.visitor_id && visitorMap.has(local.visitor_id)) {
            const matched = visitorMap.get(local.visitor_id)!;
            local.visitor_name = local.visitor_name || matched.name;
            local.visitor_phone = local.visitor_phone || matched.phone;
          }
          const cloudRow = map.get(local.id);
          const localIsDirty = !local.synced_at || local.sync_status === 'pending';
          if (localIsDirty) {
            map.set(local.id, { ...(cloudRow || {}), ...local });
          } else {
            map.set(local.id, { ...local, ...cloudRow });
          }
        });
        this.visits = Array.from(map.values()).sort(
          (a, b) => new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime()
        );
      }
    } catch (e) { /* silent */ }

    if (branchId) {
      return this.visits.filter(v => v.branch_id === branchId);
    }
    if (collegeId) {
      const collegeBranchIds = directoryService.getBranchesArray().filter(b => b.college_id === collegeId).map(b => b.id);
      return this.visits.filter(v => collegeBranchIds.includes(v.branch_id));
    }
    return this.visits;
  }

  async clearVisits(branchId?: string): Promise<void> {
    if (branchId) {
      this.visits = this.visits.filter(v => v.branch_id !== branchId);
      try {
        const branchVisits = await localDb.local_visits.where('branch_id').equals(branchId).toArray();
        const ids = branchVisits.map(v => v.id);
        await localDb.local_visits.bulkDelete(ids);
      } catch (e) { /* silent */ }

      if (isCloudReady() && supabase) {
        await safeMutation(
          () => supabase!.from('visits').delete().eq('branch_id', branchId),
          'clear branch visits'
        );
      }
    } else {
      this.visits = [];
      try {
        await localDb.local_visits.clear();
      } catch (e) { /* silent */ }

      if (isCloudReady() && supabase) {
        await safeMutation(
          () => supabase!.from('visits').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
          'clear all visits'
        );
      }
    }
    await auditService.logAudit('receptionist', 'Front Desk', 'clear_visits_log', 'branch', { branch_id: branchId });
    eventBus.emit('visit:cleared', { branchId });
  }

  // ─── NOTIFICATION DISPATCH ───────────────────────────────────

  async autoDispatchPassNotification(visit: Visit): Promise<{ success: boolean; channel: string }> {
    try {
      const visitorPhone = visit.visitor_phone;
      if (!visitorPhone) return { success: false, channel: 'none' };

      await auditService.logAudit('system', 'Front Desk', 'auto_pass_notification_prepared', 'branch', { visitor_phone: visitorPhone, qr_token: visit.qr_token });
      return { success: true, channel: 'whatsapp_direct' };
    } catch (e) {
      console.warn('Auto dispatch notification fallback:', e);
      return { success: false, channel: 'error' };
    }
  }

  // ─── STATE ACCESS ────────────────────────────────────────────

  getVisitsArray(): Visit[] {
    return this.visits;
  }

  getVisitorsArray(): Visitor[] {
    return this.visitors;
  }
}

export const visitService = new VisitService();
