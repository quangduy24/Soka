/**
 * Soka Intent Engine — Server Entry Point
 *
 * Express server integrating:
 * - Modular API routes (backend/src/api/routes.ts)
 * - Middleware: rate limiting, request logging, error handling
 * - Vite dev server for frontend SPA
 * - Mezo Testnet EVM integration
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

// Backend modules
import { apiRouter } from "./backend/src/api/routes.js";
import { rateLimiter, requestLogger, errorHandler } from "./backend/src/api/middleware.js";
import { logger } from "./backend/src/utils/logger.js";
import { SERVER_PORT, NODE_ENV, validateConfig, MEZO_CHAIN_ID, CORS_ORIGINS } from "./backend/src/config/index.js";

async function startServer() {
  validateConfig();

  const app = express();

  // ─── Core Middleware ─────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));

  // CORS: same-origin by default; opt-in origins via CORS_ORIGIN env.
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && CORS_ORIGINS.length > 0 && CORS_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Request logging
  app.use('/api', requestLogger);

  // Rate limiting
  app.use('/api', rateLimiter);

  // ─── API Routes ──────────────────────────────────────────────
  app.use('/api', apiRouter);

  // Unknown API routes return JSON (never the SPA shell)
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Unknown API endpoint' });
  });

  // ─── Error Handler ───────────────────────────────────────────
  app.use(errorHandler);

  // ─── Frontend (Vite SPA) ─────────────────────────────────────
  if (NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // Fallback all other routes to index.html
    app.use('*', async (req, res, next) => {
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // ─── Start Server ────────────────────────────────────────────
  app.listen(SERVER_PORT, "0.0.0.0", () => {
    logger.info(`🚀 Soka Intent Engine running on http://localhost:${SERVER_PORT}`, {
      env: NODE_ENV,
      network: 'Mezo Testnet',
      chainId: MEZO_CHAIN_ID,
    });
    logger.info('API endpoints:', {
      endpoints: [
        'POST /api/parse-intent',
        'POST /api/calculate-optimal-route',
        'POST /api/evaluate-guardian-risk',
        'POST /api/balance',
        'POST /api/execute-swap',
        'POST /api/process-intent',
        'POST /api/bridge-out',
        'GET  /api/bridge-info',
        'POST /api/mezo-rpc',
        'GET  /api/prices',
        'GET  /api/pools',
        'GET  /api/pools/:address',
        'POST /api/pools/quote-liquidity',
        'POST /api/pools/quote-remove',
        'POST /api/pools/add-liquidity',
        'POST /api/pools/remove-liquidity',
        'POST /api/borrow-quote',
      ],
    });
  });
}

startServer().catch((err) => {
  logger.error('Failed to start server', { error: err.message, stack: err.stack });
  process.exit(1);
});
