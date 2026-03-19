/**
 * Structured logger for server-side code.
 * Wraps console methods with consistent formatting.
 * Replace with Pino/Winston in production for JSON logging.
 */
export const logger = {
  error(message: string, error?: unknown, context?: Record<string, unknown>) {
    const errorDetail = error instanceof Error ? { message: error.message, stack: error.stack } : error;
    console.error(JSON.stringify({ level: 'error', message, error: errorDetail, ...context, timestamp: new Date().toISOString() }));
  },
  warn(message: string, context?: Record<string, unknown>) {
    console.warn(JSON.stringify({ level: 'warn', message, ...context, timestamp: new Date().toISOString() }));
  },
  info(message: string, context?: Record<string, unknown>) {
    console.info(JSON.stringify({ level: 'info', message, ...context, timestamp: new Date().toISOString() }));
  },
};
