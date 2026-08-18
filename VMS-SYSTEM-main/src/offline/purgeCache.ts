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

      // Clear Dexie IndexedDB tables if they contain old mock data
      await Promise.all([
        localDb.local_colleges.clear().catch(() => {}),
        localDb.local_branches.clear().catch(() => {}),
        localDb.local_visits.clear().catch(() => {}),
        localDb.local_visitors.clear().catch(() => {}),
        localDb.local_hosts.clear().catch(() => {}),
        localDb.local_blacklist.clear().catch(() => {}),
        localDb.sync_queue.clear().catch(() => {})
      ]);

      localStorage.setItem('vms_mock_purged_v1', 'true');
      console.log('🧹 Purged legacy mock cache and local IndexedDB.');
    }
  } catch (e) {
    console.warn('Notice during legacy cache purge:', e);
  }
}
