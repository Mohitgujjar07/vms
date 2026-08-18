/**
 * VMS Telemetry & Error Tracking Service
 * Sentry-compatible centralized error monitoring and context enrichment.
 * Captures unhandled runtime exceptions, failed database queries, sync queue failures,
 * and security login events with user role and scope context.
 */

export interface TelemetryContext {
  role?: string;
  college_id?: string | null;
  branch_id?: string | null;
  action?: string;
  metadata?: Record<string, any>;
}

class TelemetryService {
  private sentryDsn: string = (import.meta as any).env?.VITE_SENTRY_DSN || '';
  private isInitialized: boolean = false;
  private currentUserContext: TelemetryContext = {};

  /**
   * Initialize error tracking telemetry on app launch
   */
  initTelemetry(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    if (this.sentryDsn) {
      console.log('⚡ Sentry Telemetry initialized with DSN configuration.');
    } else {
      console.log('ℹ️ Local Telemetry initialized (Sentry DSN not provided in env).');
    }

    // Capture unhandled window error events
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.captureException(event.error || new Error(event.message), {
          action: 'unhandled_window_error',
          metadata: { filename: event.filename, lineno: event.lineno, colno: event.colno }
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.captureException(
          event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
          { action: 'unhandled_promise_rejection' }
        );
      });
    }
  }

  /**
   * Set global user context for enriched error reports
   */
  setUserContext(context: TelemetryContext): void {
    this.currentUserContext = { ...this.currentUserContext, ...context };
  }

  /**
   * Clear user context on logout
   */
  clearUserContext(): void {
    this.currentUserContext = {};
  }

  /**
   * Capture runtime exception with structured context
   */
  captureException(error: Error | any, context?: TelemetryContext): void {
    const mergedContext = { ...this.currentUserContext, ...context };
    const errObj = error instanceof Error ? error : new Error(String(error || 'Unknown Error'));

    console.warn(`[TELEMETRY EXCEPTION] [${mergedContext.action || 'system'}]`, {
      message: errObj.message,
      stack: errObj.stack,
      role: mergedContext.role || 'anonymous',
      college_id: mergedContext.college_id || 'n/a',
      branch_id: mergedContext.branch_id || 'n/a',
      metadata: mergedContext.metadata
    });

    // Send to Sentry SDK if configured in production
    if (typeof (window as any).Sentry !== 'undefined') {
      try {
        (window as any).Sentry.withScope((scope: any) => {
          if (mergedContext.role) scope.setTag('user.role', mergedContext.role);
          if (mergedContext.college_id) scope.setTag('college_id', mergedContext.college_id);
          if (mergedContext.branch_id) scope.setTag('branch_id', mergedContext.branch_id);
          if (mergedContext.action) scope.setTag('action', mergedContext.action);
          if (mergedContext.metadata) scope.setExtras(mergedContext.metadata);
          (window as any).Sentry.captureException(errObj);
        });
      } catch (e) {
        /* silent */
      }
    }
  }

  /**
   * Capture operational or security warning message
   */
  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'warning', context?: TelemetryContext): void {
    const mergedContext = { ...this.currentUserContext, ...context };
    console.warn(`[TELEMETRY ${level.toUpperCase()}] [${mergedContext.action || 'notice'}]: ${message}`, mergedContext);
  }
}

export const telemetry = new TelemetryService();
