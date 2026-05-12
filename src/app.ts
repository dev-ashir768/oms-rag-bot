import express from 'express';
import helmet from 'helmet';
import path from 'path';
import corsMiddleware from './middleware/cors.middleware';
import { globalLimiter } from './middleware/rateLimit.middleware';
import errorMiddleware from './middleware/error.middleware';
import routes from './routes';
import logger from './utils/logger';

const app = express();

// ─── Security headers ────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow widget assets cross-origin
    contentSecurityPolicy: false,
  }),
);

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(corsMiddleware);

// ─── Body parsers ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Global rate limit ────────────────────────────────────────────────────────
app.use(globalLimiter);

// ─── Request logger ──────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// ─── Static widget ───────────────────────────────────────────────────────────
// Serve widget/chatbot-widget.js at /widget/chatbot-widget.js
// Any site can embed: <script src="http://yourserver.com/widget/chatbot-widget.js" ...></script>
app.use(
  '/widget',
  express.static(path.join(process.cwd(), 'widget'), {
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=3600');
    },
  }),
);

// ─── API routes ──────────────────────────────────────────────────────────────
app.use('/api', routes);

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ─── Error handler ───────────────────────────────────────────────────────────
app.use(errorMiddleware);

export default app;
