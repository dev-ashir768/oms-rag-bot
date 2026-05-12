import { Router } from 'express';
import { chatLimiter } from '../middleware/rateLimit.middleware';
import { handleChat, handleClearSession } from '../controllers/chat.controller';

const router = Router();

// POST   /api/chat                    → Send message, get answer
// DELETE /api/chat/session/:sessionId → Clear conversation history
router.post('/', chatLimiter, handleChat);
router.delete('/session/:sessionId', handleClearSession);

export default router;
