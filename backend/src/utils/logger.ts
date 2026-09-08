/**
 * DIEPS Intent Engine — Winston Logger
 * Structured logging with configurable levels and request timing.
 */

import winston from 'winston';
import { LOG_LEVEL, NODE_ENV } from '../config/index.js';

const { combine, timestamp, printf, colorize, errors } = winston.format;

/** Custom log format for development */
const devFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level}] ${stack || message}${metaStr}`;
});

/** Custom log format for production (JSON) */
const prodFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  return JSON.stringify({
    timestamp,
    level,
    message: stack || message,
    ...meta,
  });
});

/** Main application logger */
export const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        NODE_ENV === 'production' ? prodFormat : combine(colorize(), devFormat),
      ),
    }),
  ],
});

/**
 * Create a performance timer for measuring operation duration.
 * @param label - Operation label for logging
 * @returns Object with `end()` method that logs the duration
 */
export function createTimer(label: string) {
  const start = performance.now();
  return {
    end: (meta?: Record<string, any>) => {
      const duration = (performance.now() - start).toFixed(2);
      logger.info(`${label} completed`, { durationMs: duration, ...meta });
      return parseFloat(duration);
    },
  };
}

/**
 * Log an API request
 */
export function logRequest(method: string, path: string, body?: any) {
  logger.debug(`→ ${method} ${path}`, {
    body: body ? JSON.stringify(body).slice(0, 200) : undefined,
  });
}

/**
 * Log an API response
 */
export function logResponse(method: string, path: string, status: number, durationMs?: number) {
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
  logger.log(level, `← ${method} ${path} ${status}`, { durationMs });
}
