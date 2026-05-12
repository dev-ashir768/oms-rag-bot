import { Router, Request, Response } from 'express';
import chatRoutes from './chat.routes';
import ingestRoutes from './ingest.routes';
import { isReady, getVectorCount } from '../services/vectorstore.service';

const router = Router();

router.use('/chat', chatRoutes);
router.use('/ingest', ingestRoutes);

// ────────────────────────────────────────────────────────────────────────────
// GET /api/status
// Tells you whether the bot is ready to answer questions.
// vectorStore: "ready"  → documents have been ingested, bot is answering
// vectorStore: "empty"  → no documents yet, need to ingest first
// ────────────────────────────────────────────────────────────────────────────
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    vectorStore: isReady() ? 'ready' : 'empty',
    vectorCount: getVectorCount(),
    ts: new Date().toISOString(),
  });
});

export default router;
