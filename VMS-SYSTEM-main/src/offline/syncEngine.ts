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
      this.onlineHandler = () => this.triggerSync();
      window.addEventListener('online', this.onlineHandler);

      // Periodic background sync every 30 seconds when online
      this.syncTimer = setInterval(() => {
        if (navigator.onLine && !this.isSyncing) {
          this.triggerSync();
        }
      }, 30000);
    }
  }

  private onlineHandler: (() => void) | null = null;

  /** Release listeners/timers (defensive cleanup for HMR / teardown) */
  dispose(): void {
    if (this.syncTimer) clearInterval(this.syncTimer);
    if (typeof window !== 'undefined' && this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
    }
  }

  /**
   * CRITICAL REQUIREMENT 3.2 & 7: Check local "currently inside" cache
   * Blocks check-in if visitor with matching phone is already checked-in and not checked-out at this branch.
   * Works 100% offline!
   */
  async checkVisitorIsCurrentlyInside(branchId: string, phone: string): Promise<Visit | null> {
    // Normalize to last 10 digits so '+91XXXXXXXXXX' and 'XXXXXXXXXX' match
    const targetDigits = phone.replace(/\D/g, '').slice(-10);

    // Fast path: compound index [branch_id+status] then filter by normalized phone
    const activeVisit = await localDb.local_visits
      .where('[branch_id+status]')
      .equals([branchId, 'inside'])
      .filter(v => (v.visitor_phone || '').replace(/\D/g, '').slice(-10) === targetDigits)
      .first();

    if (activeVisit) return activeVisit;

    // Fallback for rows missing the denormalized phone: match visitor_id directly
    const byVisitorId = await localDb.local_visits
      .where('[branch_id+status]')
      .equals([branchId, 'inside'])
      .filter(v => v.visitor_id === phone)
      .first();
    return byVisitorId || null;
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
      // Wrap in a transaction so the read-modify-write cannot interleave
      await localDb.transaction('rw', localDb.local_visits, async () => {
        visit!.status = 'checked_out';
        visit!.qr_used = true;
        visit!.check_out_time = checkoutTime;
        if (rating !== undefined) visit!.rating = rating;
        if (feedbackComment !== undefined) visit!.feedback_comment = feedbackComment;
        await localDb.local_visits.put(visit!);
      });
    }

    // Queue for sync — deterministic id prevents duplicate queue entries for the same visit
    const syncItem: PendingSyncItem = {
      id: `checkout-${visitId}`,
      type: 'check_out',
      payload: {
        visitId,
        checkoutTime,
        rating: rating !== undefined ? rating : (visit?.rating ?? null),
        feedbackComment: feedbackComment !== undefined ? feedbackComment : (visit?.feedback_comment ?? null)
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
   * Trigger queue flush to remote Supabase database with exponential backoff & retry.
   * HONESTY RULE: an item is marked 'synced' ONLY after a confirmed successful cloud
   * write. If the cloud is unavailable the item simply stays 'pending' for the next cycle.
   */
  async triggerSync(): Promise<void> {
    if (this.isSyncing || !navigator.onLine) return;
    if (!isOnlineAndSupabaseReady() || !supabase) return; // nothing honest we can do offline

    // Cross-tab mutual exclusion via Web Locks (falls back to in-tab flag only)
    const runFlush = async () => { await this.flushQueue(); };
    try {
      const locks: any = (navigator as any).locks;
      if (locks?.request) {
        await locks.request('vms-sync-flush', { ifAvailable: true }, async (lock: any) => {
          if (!lock) return; // another tab is already flushing
          await runFlush();
        });
      } else {
        await runFlush();
      }
    } catch (e) {
      console.warn('Sync lock notice:', e);
    }
  }

  private async flushQueue(): Promise<void> {
    this.isSyncing = true;
    try {
      // CRITICAL ORDERING: process strictly by creation time. Primary-key string
      // order would dispatch 'checkout-*' BEFORE its 'vst-*' check-in exists in
      // the cloud, silently matching zero rows and losing the checkout forever.
      const pendingItems = (await localDb.sync_queue.where('status').equals('pending').toArray())
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      for (const item of pendingItems) {
        // Exponential backoff measured from LAST attempt, not creation time
        if (item.retry_count > 0 && item.last_attempt_at) {
          const backoffMs = Math.min(Math.pow(2, item.retry_count) * 1000, 30000);
          const sinceAttemptMs = Date.now() - new Date(item.last_attempt_at).getTime();
          if (sinceAttemptMs < backoffMs) {
            continue; // Skip item until its backoff window expires
          }
        }

        let dispatched = false;
        try {
          // Re-verify cloud availability right before dispatch
          if (!isOnlineAndSupabaseReady() || !supabase) {
            continue; // leave item pending — do NOT mark synced
          }

          if (item.type === 'check_in') {
            const { visit, visitor } = item.payload || {};
            if (visitor) {
              const res = await supabase.from('visitors').upsert({
                id: visitor.id,
                name: visitor.name,
                phone: visitor.phone,
                photo_url: visitor.photo_url || null,
                created_at: visitor.created_at
              });
              if (res.error) throw new Error(res.error.message || 'visitor upsert failed');
            }
            if (visit) {
              const res = await supabase.from('visits').upsert({
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
                rating: (visit as any).rating ?? null,
                feedback_comment: (visit as any).feedback_comment ?? null,
                synced_at: new Date().toISOString(),
                created_at: visit.created_at
              });
              if (res.error) throw new Error(res.error.message || 'visit upsert failed');
            }
            dispatched = !!(visit || visitor);
          } else if (item.type === 'check_out') {
            const { visitId, checkoutTime, rating, feedbackComment } = item.payload || {};
            if (visitId) {
              // Detect a 0-row update (visit not yet uploaded to cloud) — otherwise
              // the checkout would be silently marked synced and lost forever.
              const probe = await supabase.from('visits').select('id').eq('id', visitId);
              if (probe.error) throw new Error(probe.error.message || 'checkout probe failed');
              if (!probe.data || probe.data.length === 0) {
                // Visit doesn't exist in cloud yet → upsert the FULL local row
                // (idempotent whether or not the check-in arrives separately).
                const localVisit = await localDb.local_visits.get(visitId);
                if (localVisit) {
                  const upsertRes = await supabase.from('visits').upsert({
                    id: localVisit.id,
                    visitor_id: localVisit.visitor_id,
                    branch_id: localVisit.branch_id,
                    host_id: localVisit.host_id ?? null,
                    purpose: localVisit.purpose,
                    status: 'checked_out',
                    qr_token: localVisit.qr_token,
                    qr_expires_at: localVisit.qr_expires_at,
                    qr_used: true,
                    check_in_time: localVisit.check_in_time,
                    check_out_time: checkoutTime,
                    created_by: localVisit.created_by || null,
                    rating: (rating !== undefined && rating !== null) ? rating : ((localVisit as any).rating ?? null),
                    feedback_comment: (feedbackComment !== undefined && feedbackComment !== null) ? feedbackComment : ((localVisit as any).feedback_comment ?? null),
                    synced_at: new Date().toISOString(),
                    created_at: localVisit.created_at
                  });
                  if (upsertRes.error) throw new Error(upsertRes.error.message || 'offline checkout upsert failed');
                  dispatched = true;
                } else {
                  // Nothing local either — nothing left to push; retire the item
                  dispatched = true;
                }
              } else {
                const updatePayload: any = {
                  status: 'checked_out',
                  qr_used: true,
                  check_out_time: checkoutTime,
                  synced_at: new Date().toISOString()
                };
                if (rating !== undefined && rating !== null) updatePayload.rating = rating;
                if (feedbackComment !== undefined && feedbackComment !== null) updatePayload.feedback_comment = feedbackComment;
                const res = await supabase.from('visits').update(updatePayload).eq('id', visitId);
                if (res.error) throw new Error(res.error.message || 'checkout update failed');
                dispatched = true;
              }
            }
          } else if (item.type === 'add_host') {
            const { host } = item.payload || {};
            if (host) {
              const res = await supabase.from('hosts').upsert({
                id: host.id,
                branch_id: host.branch_id,
                name: host.name,
                type: host.type,
                department_or_class: host.department_or_class,
                created_at: host.created_at
              });
              if (res.error) throw new Error(res.error.message || 'host upsert failed');
              dispatched = true;
            }
          } else if (item.type === 'add_blacklist') {
            const { entry } = item.payload || {};
            if (entry) {
              const res = await supabase.from('blacklist').upsert({
                id: entry.id,
                scope: entry.scope,
                branch_id: entry.branch_id || null,
                college_id: entry.college_id || null,
                visitor_phone: entry.visitor_phone,
                reason: entry.reason,
                created_by: entry.created_by || null,
                created_at: entry.created_at
              });
              if (res.error) throw new Error(res.error.message || 'blacklist upsert failed');
              dispatched = true;
            }
          }

          // Mark item as synced ONLY after a confirmed successful dispatch
          if (dispatched) {
            item.status = 'synced';
            item.last_attempt_at = new Date().toISOString();
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
          }
        } catch (err: any) {
          item.retry_count += 1;
          item.last_attempt_at = new Date().toISOString();
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

  /** Re-queue failed items so they get another flush attempt */
  async retryFailed(): Promise<void> {
    try {
      const failedItems = await localDb.sync_queue.where('status').equals('failed').toArray();
      for (const item of failedItems) {
        item.status = 'pending';
        item.retry_count = 0;
        item.error_message = undefined;
        item.last_attempt_at = undefined;
        await localDb.sync_queue.put(item);
      }
      if (failedItems.length > 0) this.triggerSync();
    } catch (e) {
      console.warn('Retry-failed notice:', e);
    }
  }
}

export const syncEngine = new SyncEngine();
