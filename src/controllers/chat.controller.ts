import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { chat, clearSession } from '../services/rag.service';
import { ChatRequestBody } from '../types';
import logger from '../utils/logger';

// ────────────────────────────────────────────────────────────────────────────
// POST /api/chat
// Body: { message: string }
// Header (optional): X-Session-Id — send this back on subsequent requests
//                                   to keep the conversation going
// ────────────────────────────────────────────────────────────────────────────
export async function handleChat(
  req: Request<unknown, unknown, ChatRequestBody>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ error: 'message field is required and must be a non-empty string' });
      return;
    }

    if (message.length > 2000) {
      res.status(400).json({ error: 'Message too long — max 2000 characters' });
      return;
    }

    // Use existing session from header, or create a brand-new one
    const sessionId = (req.headers['x-session-id'] as string) || uuidv4();

    logger.info(`Chat — session: ${sessionId} | msg: "${message.slice(0, 60)}..."`);

    const result = await chat(sessionId, message.trim());

    // Always echo back the session ID so the client can store it
    res.setHeader('X-Session-Id', sessionId);
    res.json({
      success: true,
      sessionId,
      answer: result.answer,
      sources: result.sources,
    });
  } catch (err) {
    next(err);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// DELETE /api/chat/session/:sessionId
// Clears the chat history for a specific user session
// Use this when user clicks "New Chat" or logs out
// ────────────────────────────────────────────────────────────────────────────
export async function handleClearSession(
  req: Request<{ sessionId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      res.status(400).json({ error: 'sessionId param is required' });
      return;
    }

    clearSession(sessionId);
    logger.info(`Session cleared: ${sessionId}`);

    res.json({ success: true, message: 'Session history cleared' });
  } catch (err) {
    next(err);
  }
}
