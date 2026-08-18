import { localDb, PendingSyncItem } from './db';
import { Visit, Visitor } from '../types';
import { supabase, isOnlineAndSupabaseReady } from '../lib/supabaseClient';

export interface SyncStatus {
  pendingCount: number;
  failedCount: number;
  isSyncing: boolean;
  lastSyncAt: string | null;
}

export class SyncEngine {
  private isSyncing = false;
  private syncTimer: any = null;
  private lastSyncAt: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.triggerSync());
      
      // Periodic background sync every 30 seconds when online
      this.syncTimer = setInterval(() => {
        if (navigator.onLine && !this.isSyncing) {
          this.triggerSync();
        }
      }, 30000);
    }
  }

  /**
   * CRITICAL REQUIREMENT 3.2 & 7: Check local "currently inside" cache
   * Blocks check-in if visitor with matching phone is already checked-in and not checked-out at this branch.
   * Works 100% offline!
   */
  async checkVisitorIsCurrentlyInside(branchId: string, phone: string): Promise<Visit | null> {
    const cleanPhone = phone.trim().toLowerCase();
    
    // Query local IndexedDB for active visit
    const activeVisit = await localDb.local_visits
      .where('branch_id')
      .equals(branchId)
      .filter(v => v.status === 'inside' && (v.visitor_phone?.toLowerCase() === cleanPhone || v.visitor_id === phone))
      .first();

    return activeVisit || null;
  }

  /**
   * Enqueue a local check-in write operation
   */
  async queueCheckIn(visit: Visit, visitor: Visitor): Promise<{ visit: Visit; isOffline: boolean }> {
    // 1. Save visitor in local DB cache
    await localDb.local_visitors.put(visitor);

    // 2. Save visit record locally
    await localDb.local_visits.put(visit);

    // 3. Queue for remote synchronization
    const syncItem: PendingSyncItem = {
      id: visit.id,
      type: 'check_in',
      payload: { visit, visitor },
      status: 'pending',
      retry_count: 0,
      created_at: new Date().toISOString()
    };
    await localDb.sync_queue.put(syncItem);

    // 4. Try syncing immediately if online
    const isOnline = navigator.onLine;
    if (isOnline) {
      this.triggerSync();
    }

    return { visit, isOffline: !isOnline };
  }

  /**
   * Enqueue a local check-out write operation
   */
  async queueCheckOut(visitId: string, checkoutTime: string, visitObj?: Visit, rating?: number | null, feedbackComment?: string | null): Promise<{ success: boolean; isOffline: boolean }> {
    let visit = await localDb.local_visits.get(visitId);
    if (!visit && visitObj) {
      visit = { ...visitObj };
    }
    
    if (visit) {
      visit.status = 'checked_out';
      visit.qr_used = true;
      visit.check_out_time = checkoutTime;
      if (rating !== undefined) visit.rating = rating;
      if (feedbackComment !== undefined) visit.feedback_comment = feedbackComment;
      await localDb.local_visits.put(visit);
    }

    // Queue for sync
    const syncItem: PendingSyncItem = {
      id: `checkout-${visitId}-${Date.now()}`,
      type: 'check_out',
      payload: {
        visitId,
        checkoutTime,
        rating: rating || visit?.rating || null,
        feedbackComment: feedbackComment || visit?.feedback_comment || null
      },
      status: 'pending',
      retry_count: 0,
      created_at: new Date().toISOString()
    };
    await localDb.sync_queue.put(syncItem);

    const isOnline = navigator.onLine;
    if (isOnline) {
      this.triggerSync();
    }

    return { success: true, isOffline: !isOnline };
  }

  /**
   * Get pending queue count for sync status indicator
   */
  async getPendingCount(): Promise<number> {
    return await localDb.sync_queue.where('status').equals('pending').count();
  }

  /**
   * Detailed sync status overview for health monitors & indicators
   */
  async getSyncStatus(): Promise<SyncStatus> {
    const pendingCount = await localDb.sync_queue.where('status').equals('pending').count();
    const failedCount = await localDb.sync_queue.where('status').equals('failed').count();
    return {
      pendingCount,
      failedCount,
      isSyncing: this.isSyncing,
      lastSyncAt: this.lastSyncAt
    };
  }

  /**
   * Clean up old synced records older than 24 hours to keep IndexedDB light
   */
  async cleanupOldSyncedQueue(): Promise<void> {
    try {
      const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const oldItems = await localDb.sync_queue
        .where('status')
        .equals('synced')
        .filter(item => item.created_at < dayAgo)
        .toArray();

      if (oldItems.length > 0) {
        const ids = oldItems.map(i => i.id);
        await localDb.sync_queue.bulkDelete(ids);
      }
    } catch (e) {
      console.warn('Queue cleanup notice:', e);
    }
  }

  /**
   * Trigger queue flush to remote Supabase database with exponential backoff & retry
   */
  async triggerSync(): Promise<void> {
    if (this.isSyncing || !navigator.onLine) return;

    this.isSyncing = true;
    try {
      const pendingItems = await localDb.sync_queue.where('status').equals('pending').toArray();

      for (const item of pendingItems) {
        // Exponential backoff check: if retried before, wait 2^retry_count seconds
        if (item.retry_count > 0) {
          const backoffMs = Math.min(Math.pow(2, item.retry_count) * 1000, 30000);
          const itemAgeMs = Date.now() - new Date(item.created_at).getTime();
          if (itemAgeMs < backoffMs) {
            continue; // Skip item for now until backoff window expires
          }
        }

        try {
          if (isOnlineAndSupabaseReady() && supabase) {
            if (item.type === 'check_in') {
              const { visit, visitor } = item.payload || {};
              if (visitor) {
                await supabase.from('visitors').upsert({
                  id: visitor.id,
                  name: visitor.name,
                  phone: visitor.phone,
                  photo_url: visitor.photo_url || null,
                  created_at: visitor.created_at
                });
              }
              if (visit) {
                await supabase.from('visits').upsert({
                  id: visit.id,
                  visitor_id: visit.visitor_id,
                  branch_id: visit.branch_id,
                  host_id: visit.host_id,
                  purpose: visit.purpose,
                  status: visit.status,
                  qr_token: visit.qr_token,
                  qr_expires_at: visit.qr_expires_at,
                  qr_used: visit.qr_used,
                  check_in_time: visit.check_in_time,
                  check_out_time: visit.check_out_time || null,
                  created_by: visit.created_by || null,
                  created_at: visit.created_at
                });
              }
            } else if (item.type === 'check_out') {
              const { visitId, checkoutTime, rating, feedbackComment } = item.payload || {};
              if (visitId) {
                const updatePayload: any = {
                  status: 'checked_out',
                  qr_used: true,
                  check_out_time: checkoutTime
                };
                if (rating) updatePayload.rating = rating;
                if (feedbackComment) updatePayload.feedback_comment = feedbackComment;
                await supabase.from('visits').update(updatePayload).eq('id', visitId);
              }
            } else if (item.type === 'add_host') {
              const { host } = item.payload || {};
              if (host) {
                await supabase.from('hosts').upsert({
                  id: host.id,
                  branch_id: host.branch_id,
                  name: host.name,
                  type: host.type,
                  department_or_class: host.department_or_class,
                  created_at: host.created_at
                });
              }
            } else if (item.type === 'add_blacklist') {
              const { entry } = item.payload || {};
              if (entry) {
                await supabase.from('blacklist').upsert({
                  id: entry.id,
                  scope: entry.scope,
                  branch_id: entry.branch_id || null,
                  college_id: entry.college_id || null,
                  visitor_phone: entry.visitor_phone,
                  reason: entry.reason,
                  created_by: entry.created_by || null,
                  created_at: entry.created_at
                });
              }
            } else if (item.type === 'add_sos') {
              const { alert } = item.payload || {};
              if (alert) {
                await supabase.from('emergency_sos_alerts').upsert({
                  id: alert.id,
                  branch_id: alert.branch_id,
                  branch_name: alert.branch_name,
                  receptionist_id: alert.receptionist_id || null,
                  receptionist_name: alert.receptionist_name,
                  message: alert.message,
                  is_active: alert.is_active,
                  created_at: alert.created_at
                });
              }
            }
          }

          // Mark item as synced in local DB
          item.status = 'synced';
          await localDb.sync_queue.put(item);

          // Update visit synced_at timestamp
          if (item.type === 'check_in' && item.payload?.visit?.id) {
            const localVisit = await localDb.local_visits.get(item.payload.visit.id);
            if (localVisit) {
              localVisit.synced_at = new Date().toISOString();
              localVisit.sync_status = 'synced';
              await localDb.local_visits.put(localVisit);
            }
          }
        } catch (err: any) {
          item.retry_count += 1;
          item.error_message = err?.message || 'Network sync error';
          if (item.retry_count > 5) {
            item.status = 'failed';
          }
          await localDb.sync_queue.put(item);
        }
      }

      this.lastSyncAt = new Date().toISOString();
      await this.cleanupOldSyncedQueue();
    } finally {
      this.isSyncing = false;
    }
  }
}

export const syncEngine = new SyncEngine();
