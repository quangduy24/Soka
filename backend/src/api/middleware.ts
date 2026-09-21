/**
 * Soka Intent Engine — API Middleware
 * Request validation, error handling, rate limiting, and logging.
 */

import type { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { RATE_LIMIT, MS_TO_SEC } from '../config/index.js';
import { logger, logRequest, logResponse } from '../utils/logger.js';

// ─── Request Validation Middleware ─────────────────────────────

/**
 * Create a validation middleware for a Zod schema.
 * Validates req.body and returns 400 with detailed errors on failure.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return res.status(400).json({
          error: 'Validation failed',
          details: errors,
          validation_status: 'INVALID_FORMAT',
        });
      }
      next(err);
    }
  };
}

// ─── Error Handling Middleware ──────────────────────────────────

/**
 * Global error handler.
 * Catches unhandled errors and returns clean JSON responses.
 */
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Don't leak internal errors in production
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  res.status(500).json({
    error: message,
    validation_status: 'SERVER_ERROR',
  });
}

// ─── Rate Limiting ─────────────────────────────────────────────

/** In-memory rate limit store */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Simple in-memory rate limiter.
 * Per-IP rate limiting with configurable window and max requests.
 */
export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  let entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT.windowMs };
    rateLimitStore.set(ip, entry);
  }

  entry.count++;

  if (entry.count > RATE_LIMIT.maxRequests) {
    logger.warn('Rate limit exceeded', { ip, count: entry.count });
    return res.status(429).json({
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((entry.resetAt - now) / MS_TO_SEC),
    });
  }

  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT.maxRequests);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT.maxRequests - entry.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / MS_TO_SEC));

  next();
}

// Periodic cleanup of expired entries
const rateLimitCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(ip);
    }
  }
}, RATE_LIMIT.cleanupIntervalMs);
// Do not keep the process alive for housekeeping alone.
rateLimitCleanupTimer.unref?.();

// ─── Request Logging Middleware ────────────────────────────────

/**
 * Logs incoming requests and outgoing responses with timing.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = performance.now();

  logRequest(req.method, req.path, req.body);

  // Intercept response finish to log timing
  const originalEnd = res.end.bind(res);
  res.end = function (this: Response, ...args: any[]) {
    const duration = (performance.now() - start).toFixed(2);
    logResponse(req.method, req.path, res.statusCode, parseFloat(duration));
    return originalEnd(...args);
  } as any;

  next();
}
