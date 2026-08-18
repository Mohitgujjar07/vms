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
        const dbVisits = await localDb.local_visits.toArray();
        if (dbVisits && dbVisits.length > 0) {
          const map = new Map(this.visits.map(v => [v.id, v]));
          dbVisits.forEach(v => {
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

  // ─── CLOUD PHOTO STORAGE ──────────────────────────────────────

  async uploadVisitorPhoto(photoDataUrl: string, fileName?: string): Promise<string> {
    if (!photoDataUrl || !photoDataUrl.startsWith('data:image')) {
      return photoDataUrl;
    }

    // Automatically compress high-resolution camera captures to max 800x800 JPEG (~100KB)
    let processedUrl = photoDataUrl;
    try {
      const { compressImageDataUrl } = await import('../utils/imageCompressor');
      processedUrl = await compressImageDataUrl(photoDataUrl, 800, 800, 0.82);
    } catch (e) { /* fallback to original */ }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const arr = processedUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';

    if (!allowedMimeTypes.includes(mime)) {
      console.warn('Rejected file upload due to unsupported MIME type:', mime);
      return 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80';
    }

    if (isCloudReady() && supabase) {
      try {
        const bstr = atob(arr[1]);
        let n = bstr.length;
        if (n > 5 * 1024 * 1024) { // 5MB Limit
          throw new Error('Image exceeds 5MB size limit.');
        }
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const fileBlob = new Blob([u8arr], { type: mime });
        const cleanName = (fileName || 'visitor').replace(/[^a-zA-Z0-9]/g, '_');
        const path = `visitor-photos/${cleanName}_${Date.now()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('visitor-photos')
          .upload(path, fileBlob, { contentType: mime, upsert: true });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('visitor-photos')
            .getPublicUrl(path);

          if (publicUrlData?.publicUrl) {
            return publicUrlData.publicUrl;
          }
        }
      } catch (err) {
        console.warn('Supabase visitor photo upload fallback:', err);
      }
    }
    return photoDataUrl;
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
    hostId: string;
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

    // 3. Photo upload or fallback
    let finalPhotoUrl = visitorPhotoUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80';
    if (visitorPhotoUrl && visitorPhotoUrl.startsWith('data:image')) {
      finalPhotoUrl = await this.uploadVisitorPhoto(visitorPhotoUrl, cleanName);
    }

    // 4. Visitor profile lookup or registration
    let visitor = await this.lookupVisitorByPhone(cleanPhone);
    if (!visitor) {
      visitor = {
        id: `vis-${Date.now()}`,
        name: cleanName,
        phone: cleanPhone,
        photo_url: finalPhotoUrl,
        created_at: new Date().toISOString()
      };
      this.visitors.push(visitor);
    } else if (visitorPhotoUrl) {
      visitor.photo_url = finalPhotoUrl;
    }

    // 4. Host details lookup
    const host = directoryService.findHost(hostId);

    // 5. Generate dynamic tenant QR token
    const br = directoryService.getBranchesArray().find(b => b.id === branchId);
    const col = br?.college_id ? directoryService.getCollegesArray().find(c => c.id === br.college_id) : undefined;
    const collegeTag = (col?.display_name || 'CAMPUS').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const qrToken = `VMS-${collegeTag}-${randomCode}-${Date.now().toString().slice(-4)}`;

    const expiry = new Date();
    expiry.setHours(23, 59, 59, 999);

    const visit: Visit = {
      id: `vst-${Date.now()}`,
      visitor_id: visitor.id,
      branch_id: branchId,
      host_id: hostId,
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
      visitor_photo_url: visitor.photo_url,
      host_name: host?.name || 'Staff Member',
      host_department: host?.department_or_class || 'General',
      sync_status: navigator.onLine ? 'synced' : 'pending'
    };

    this.visits.unshift(visit);

    // 6. Queue IndexedDB persistence & cloud sync
    const result = await syncEngine.queueCheckIn(visit, visitor);

    await auditService.logAudit(receptionistId, data.receptionistName, 'visit_created', 'branch', {
      visitor_name: cleanName,
      visitor_phone: cleanPhone,
      qr_token: qrToken
    });

    eventBus.emit('visit:created', { visitId: visit.id, branchId });
    return result;
  }

  async processCheckOut(qrToken: string, branchId: string, rating?: number | null, feedbackComment?: string | null): Promise<{ visit: Visit; isOffline: boolean }> {
    const cleanToken = qrToken.trim().toLowerCase();
    let visit = this.visits.find(v => v.qr_token.toLowerCase() === cleanToken || v.qr_token === qrToken.trim());

    if (!visit) {
      try {
        const dbMatch = await localDb.local_visits.filter(v => v.qr_token.toLowerCase() === cleanToken).first();
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
        let query = supabase.from('visits').select('*').order('check_in_time', { ascending: false });
        if (branchId) {
          query = query.eq('branch_id', branchId);
        }
        const { data, error } = await query;
        if (data && !error && data.length > 0) {
          const cloudVisits = data as Visit[];
          cloudVisits.forEach(cv => {
            const idx = this.visits.findIndex(v => v.id === cv.id);
            if (idx !== -1) {
              this.visits[idx] = { ...this.visits[idx], ...cv };
            } else {
              this.visits.push(cv);
            }
          });
          try {
            await localDb.local_visits.bulkPut(cloudVisits);
          } catch (e) { /* silent */ }
        }
      } catch (e) {
        console.warn('Supabase getVisits fallback:', e);
      }
    }

    try {
      const dbVisits = await localDb.local_visits.toArray();
      if (dbVisits && dbVisits.length > 0) {
        const map = new Map(this.visits.map(v => [v.id, v]));
        dbVisits.forEach(v => {
          map.set(v.id, { ...(map.get(v.id) || {}), ...v });
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

  // ─── PRE-REGISTRATION ─────────────────────────────────────────

  async getPreRegisteredVisits(branchId: string): Promise<Visit[]> {
    return this.visits.filter(v => v.branch_id === branchId && v.is_pre_registered && v.status === 'checked_out');
  }

  async checkInPreRegisteredVisit(visitId: string): Promise<Visit> {
    const visit = this.visits.find(v => v.id === visitId);
    if (!visit) throw new Error("Pre-registered visit not found");
    visit.status = 'inside';
    visit.check_in_time = new Date().toISOString();
    visit.qr_used = false;
    visit.qr_expires_at = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
    await localDb.local_visits.put(visit);
    await auditService.logAudit(visit.created_by, 'Front Desk', 'prereg_fasttrack_checkin', 'branch', { visit_id: visit.id });
    eventBus.emit('visit:created', { visitId: visit.id, branchId: visit.branch_id });
    return visit;
  }

  async addPreRegisteredVisit(visit: Visit): Promise<Visit> {
    this.visits.unshift(visit);
    try {
      await localDb.local_visits.put(visit);
    } catch (e) { /* silent */ }
    eventBus.emit('visit:created', { visitId: visit.id, branchId: visit.branch_id });
    return visit;
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
