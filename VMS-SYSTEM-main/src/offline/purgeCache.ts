import { localDb } from './db';

/**
 * Purges legacy mock data from browser localStorage and IndexedDB.
 * Ensures clean production-ready state with zero lingering demo records.
 */
export async function purgeLegacyMockCache(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const hasPurged = localStorage.getItem('vms_mock_purged_v1');
    if (!hasPurged) {
      // Clear legacy storage items
      localStorage.removeItem('vms_last_login_id');
      localStorage.removeItem('vms_active_session');
      localStorage.removeItem('vms_active_profile');
      localStorage.removeItem('vms_local_passwords');

      // Clear Dexie IndexedDB tables if they contain old mock data.
      // sync_queue is deliberately PRESERVED — wiping it here (before session
      // restore) destroyed offline check-ins/checkout updates queued for upload.
      await Promise.all([
        localDb.local_colleges.clear().catch(() => {}),
        localDb.local_branches.clear().catch(() => {}),
        localDb.local_visits.clear().catch(() => {}),
        localDb.local_visitors.clear().catch(() => {}),
        localDb.local_hosts.clear().catch(() => {}),
        localDb.local_blacklist.clear().catch(() => {})
      ]);

      localStorage.setItem('vms_mock_purged_v1', 'true');
      console.log('🧹 Purged legacy mock cache and local IndexedDB.');
    } else {
      // One-time scrub of legacy embedded photos (ephemeral-photo policy)
      await scrubEmbeddedPhotos();
    }

    // One-time purge of local test data cache so only real records (Indrakummar & GURUKIRAN) display
    const hasPurgedTestData = localStorage.getItem('vms_test_data_purged_v2');
    if (!hasPurgedTestData) {
      await Promise.all([
        localDb.local_visits.clear().catch(() => {}),
        localDb.local_visitors.clear().catch(() => {}),
        localDb.sync_queue.clear().catch(() => {})
      ]);
      localStorage.setItem('vms_test_data_purged_v2', 'true');
      console.log('🧹 Cleared local test data cache for production real-visitor state.');
    }
  } catch (e) {
    console.warn('Notice during legacy cache purge:', e);
  }
}

/**
 * PHOTO POLICY ENFORCEMENT: removes any base64/data-URI photos embedded in
 * cached visit rows from older app versions. Photos are memory-only by design.
 */
export async function scrubEmbeddedPhotos(): Promise<void> {
  try {
    const flagged = localStorage.getItem('vms_photo_scrub_v1');
    if (flagged) return;
    const visits = await localDb.local_visits.toArray();
    const dirty = visits.filter(v => v.visitor_photo_url && v.visitor_photo_url.startsWith('data:'));
    if (dirty.length > 0) {
      await localDb.transaction('rw', localDb.local_visits, async () => {
        for (const v of dirty) {
          await localDb.local_visits.update(v.id, { visitor_photo_url: undefined });
        }
      });
    }
    localStorage.setItem('vms_photo_scrub_v1', 'true');
    if (dirty.length > 0) console.log(`🧹 Scrubbed ${dirty.length} embedded photo(s) from local cache.`);
  } catch (e) {
    console.warn('Notice during photo scrub:', e);
  }
}

/**
 * TENANT CACHE ISOLATION: wipes all locally cached operational data.
 * Called on login when the signed-in profile belongs to a different college
 * than the previously cached one — prevents cross-tenant data mingling on
 * shared reception tablets (IndexedDB is browser-global, not per-account).
 */
export async function purgeLocalTenantCache(): Promise<void> {
  try {
    await Promise.all([
      localDb.local_visits.clear().catch(() => {}),
      localDb.local_visitors.clear().catch(() => {}),
      localDb.local_hosts.clear().catch(() => {}),
      localDb.local_blacklist.clear().catch(() => {}),
      localDb.sync_queue.clear().catch(() => {})
    ]);
    console.log('🧹 Tenant cache purged (device switched to a different college).');
  } catch (e) {
    console.warn('Notice during tenant cache purge:', e);
  }
}
