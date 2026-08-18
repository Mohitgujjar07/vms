/**
 * VMS Supabase API Layer — Centralized cloud query helpers
 * All Supabase reads/writes go through this module for standardized
 * error handling, offline fallback, and logging.
 */

import { supabase, isOnlineAndSupabaseReady } from '../../lib/supabaseClient';
import { telemetry } from '../telemetryService';

export { supabase, isOnlineAndSupabaseReady };

/**
 * Execute a Supabase query with standardized error handling.
 * Returns { data, error } — never throws.
 */
export async function safeQuery<T>(
  queryFn: () => PromiseLike<{ data: T | null; error: any }> | Promise<{ data: T | null; error: any }>,
  fallbackLabel: string
): Promise<{ data: T | null; error: any }> {
  if (!isOnlineAndSupabaseReady() || !supabase) {
    return { data: null, error: { message: 'Offline or Supabase not configured' } };
  }
  try {
    const result = await queryFn();
    if (result.error) {
      console.warn(`Supabase ${fallbackLabel} notice:`, result.error.message);
      telemetry.captureMessage(`Supabase query failed: ${fallbackLabel} - ${result.error.message}`, 'warning', { action: 'supabase_query_fail', metadata: { label: fallbackLabel, error: result.error } });
    }
    return result;
  } catch (e: any) {
    console.warn(`Supabase ${fallbackLabel} fallback:`, e);
    telemetry.captureException(e, { action: 'supabase_query_exception', metadata: { label: fallbackLabel } });
    return { data: null, error: e };
  }
}

/**
 * Execute a Supabase mutation (insert/update/delete) with error handling.
 * Returns true on success, false on failure. Never throws.
 */
export async function safeMutation(
  mutationFn: () => PromiseLike<{ error: any }> | Promise<{ error: any }>,
  label: string
): Promise<boolean> {
  if (!isOnlineAndSupabaseReady() || !supabase) {
    return false;
  }
  try {
    const { error } = await mutationFn();
    if (error) {
      console.warn(`Supabase ${label} notice:`, error.message);
      return false;
    }
    return true;
  } catch (e: any) {
    console.warn(`Supabase ${label} fallback:`, e);
    return false;
  }
}

/**
 * Check if we can perform cloud operations right now
 */
export function isCloudReady(): boolean {
  return isOnlineAndSupabaseReady() && supabase !== null;
}
