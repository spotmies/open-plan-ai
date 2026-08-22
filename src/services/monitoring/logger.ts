import { captureException } from '@/infrastructure/monitoring/sentry';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

interface PerformanceEntry {
  label: string;
  duration: number;
  timestamp: string;
}

interface TrackingEvent {
  event: string;
  properties?: Record<string, unknown>;
  timestamp: string;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;
  private minLogLevel: LogLevel = this.isDevelopment ? 'debug' : 'info';
  private performanceMarks = new Map<string, number>();
  private eventQueue: TrackingEvent[] = [];

  private readonly LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  private shouldLog(level: LogLevel): boolean {
    return this.LOG_LEVELS[level] >= this.LOG_LEVELS[this.minLogLevel];
  }

  private formatEntry(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    };
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>) {
    if (!this.shouldLog(level)) return;

    const entry = this.formatEntry(level, message, context);

    if (this.isDevelopment) {
      const style = this.getConsoleStyle(level);
      console[level](
        `%c[${level.toUpperCase()}]%c ${message}`,
        style,
        'color: inherit',
        context || ''
      );
    } else {
      // Production: structured JSON so platform log aggregators (Vercel, Datadog, etc.) can parse it
      if (level === 'error' || level === 'warn') {
        console[level](JSON.stringify(entry));
      }
    }

    // Send error events to backend sink (non-blocking, never impacts UX)
    if (level === 'error' && !this.isDevelopment) {
      this.sendToLogSink(entry);
    }
  }

  private sendToLogSink(entry: LogEntry): void {
    try {
      captureException(new Error(entry.message), {
        level: entry.level as any,
        context: entry.context ?? {},
        timestamp: entry.timestamp,
        page_url: window.location.pathname,
      });
    } catch {
      // Sentry unavailable — structured fallback so log aggregators can still parse it.
      console.error(JSON.stringify({
        error_message: `[${entry.level.toUpperCase()}] ${entry.message}`,
        context: entry.context ?? {},
        timestamp: entry.timestamp,
        page_url: window.location.pathname,
      }));
    }
  }

  private getConsoleStyle(level: LogLevel): string {
    const styles = {
      debug: 'color: #6B7280; font-weight: bold',
      info: 'color: #3B82F6; font-weight: bold',
      warn: 'color: #F59E0B; font-weight: bold',
      error: 'color: #EF4444; font-weight: bold',
    };
    return styles[level];
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>) {
    this.log('error', message, context);
  }

  apiCall(method: string, url: string, status?: number) {
    this.info(`API ${method} ${url}`, { status });
  }

  userAction(action: string, details?: Record<string, unknown>) {
    this.info(`User: ${action}`, details);
  }

  // Performance timing methods
  startPerformance(label: string): void {
    this.performanceMarks.set(label, performance.now());
    if (this.isDevelopment) {
      console.time(label);
    }
  }

  endPerformance(label: string): number | undefined {
    const startTime = this.performanceMarks.get(label);
    if (startTime === undefined) {
      this.warn(`Performance mark "${label}" not found`);
      return undefined;
    }

    const duration = performance.now() - startTime;
    this.performanceMarks.delete(label);

    if (this.isDevelopment) {
      console.timeEnd(label);
    }

    const entry: PerformanceEntry = {
      label,
      duration,
      timestamp: new Date().toISOString(),
    };

    this.debug(`Performance: ${label}`, { duration: `${duration.toFixed(2)}ms` });

    // Future: Send performance metrics to analytics
    // this.sendPerformanceMetric(entry);

    return duration;
  }

  performance(label: string, startTime: number): void {
    const duration = performance.now() - startTime;
    this.debug(`Performance: ${label}`, { duration: `${duration.toFixed(2)}ms` });
  }

  // Grouping methods for nested logging
  group(label: string): void {
    if (this.isDevelopment) {
      console.group(`%c${label}`, 'color: #8B5CF6; font-weight: bold');
    }
  }

  groupCollapsed(label: string): void {
    if (this.isDevelopment) {
      console.groupCollapsed(`%c${label}`, 'color: #8B5CF6; font-weight: bold');
    }
  }

  groupEnd(): void {
    if (this.isDevelopment) {
      console.groupEnd();
    }
  }

  // Event tracking for analytics preparation
  track(event: string, properties?: Record<string, unknown>): void {
    const trackingEvent: TrackingEvent = {
      event,
      properties,
      timestamp: new Date().toISOString(),
    };

    this.eventQueue.push(trackingEvent);

    if (this.isDevelopment) {
      console.log(
        `%c[TRACK]%c ${event}`,
        'color: #10B981; font-weight: bold',
        'color: inherit',
        properties || ''
      );
    }

    // Future: Send to analytics service (Mixpanel, Amplitude, etc.)
    // this.flushEvents();
  }

  // Get queued events for batch sending
  getEventQueue(): TrackingEvent[] {
    return [...this.eventQueue];
  }

  // Clear event queue after successful send
  clearEventQueue(): void {
    this.eventQueue = [];
  }

  // Set minimum log level
  setLogLevel(level: LogLevel): void {
    this.minLogLevel = level;
  }

  // Table logging for structured data
  table(data: Record<string, unknown>[] | Record<string, unknown>): void {
    if (this.isDevelopment) {
      console.table(data);
    }
  }
}

export const logger = new Logger();
