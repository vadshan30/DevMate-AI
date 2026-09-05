import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import chatRoutes from './routes/chat.js';

const PORT = Number(process.env.PORT) || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

const app = express();

// ─── CORS ───────────────────────────────────────────────────
const configuredOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser requests (curl, server-to-server) and same-origin.
    if (!origin) return callback(null, true);
    if (configuredOrigins.length === 0) {
      // No allowlist configured: in dev, allow everything; in prod, reject.
      if (IS_PROD) {
        return callback(new Error('CORS: no origin allowlist configured.'));
      }
      return callback(null, true);
    }
    if (configuredOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: origin ${origin} is not allowed.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// ─── Body parser ─────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ─── Health endpoint ─────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'devmate-ai-backend',
    env: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─── API routes ──────────────────────────────────────────────
app.use('/api/chat', chatRoutes);

// ─── 404 ─────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Not found: ${req.method} ${req.path}` });
});

// ─── Error handler (last) ────────────────────────────────────
app.use((err, _req, res, _next) => {
  // CORS rejections land here too.
  const status = err.status || 500;
  console.error('[error]', status, err.message);
  res.status(status).json({
    success: false,
    error: IS_PROD ? 'Internal server error.' : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`[devmate-ai] backend listening on http://localhost:${PORT} (${NODE_ENV})`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[devmate-ai] GEMINI_API_KEY is not set — /api/chat will return 503.');
  }
});
