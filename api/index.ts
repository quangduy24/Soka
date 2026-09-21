import express from 'express';
import { apiRouter } from '../backend/src/api/routes.js';
import { rateLimiter, requestLogger, errorHandler } from '../backend/src/api/middleware.js';
import { CORS_ORIGINS, API_BODY_LIMIT, validateConfig } from '../backend/src/config/index.js';

validateConfig();

const app = express();

app.use(express.json({ limit: API_BODY_LIMIT }));

// CORS
app.use((req, res, next) => {
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

// Middleware
app.use(requestLogger);
app.use(rateLimiter);

// In Vercel, requests to /api/xyz can arrive with req.url = '/api/xyz' or req.url = '/xyz'
// Mounting both ensures routes match regardless of Vercel rewrite behavior
app.use('/api', apiRouter);
app.use(apiRouter);

app.use(errorHandler);

export default app;
