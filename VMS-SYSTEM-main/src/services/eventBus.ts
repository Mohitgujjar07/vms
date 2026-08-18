/**
 * VMS Event Bus — Centralized typed pub/sub system
 * Replaces the monolithic listeners: Set<() => void> pattern
 */

export type VmsEventType =
  | 'data:changed'
  | 'visit:created'
  | 'visit:checked_out'
  | 'visit:cleared'
  | 'sos:raised'
  | 'sos:dismissed'
  | 'blacklist:updated'
  | 'host:added'
  | 'host:imported'
  | 'profile:updated'
  | 'college:updated'
  | 'branch:updated'
  | 'auth:login'
  | 'auth:logout';

export type VmsEventPayload = Record<string, any> | undefined;

type EventCallback = (payload?: VmsEventPayload) => void;

class EventBus {
  private listeners = new Map<VmsEventType, Set<EventCallback>>();
  private globalListeners = new Set<() => void>();

  /**
   * Subscribe to a specific event type
   */
  on(event: VmsEventType, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Subscribe to ALL events (backward-compatible with the old pattern)
   * Used by components that just need to know "something changed"
   */
  subscribe(callback: () => void): () => void {
    this.globalListeners.add(callback);
    return () => {
      this.globalListeners.delete(callback);
    };
  }

  /**
   * Emit a typed event — notifies both specific and global listeners
   */
  emit(event: VmsEventType, payload?: VmsEventPayload): void {
    // Notify specific event listeners
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(cb => {
        try { cb(payload); } catch (e) { console.warn(`EventBus [${event}] listener error:`, e); }
      });
    }

    // Notify global listeners (backward-compatible "data:changed" behavior)
    this.globalListeners.forEach(cb => {
      try { cb(); } catch (e) { console.warn('EventBus global listener error:', e); }
    });
  }

  /**
   * Remove all listeners (used during cleanup/testing)
   */
  clear(): void {
    this.listeners.clear();
    this.globalListeners.clear();
  }
}

export const eventBus = new EventBus();
