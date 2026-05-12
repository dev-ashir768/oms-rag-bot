import { Request } from 'express';

// ─── Chat ────────────────────────────────────────────────────────────────────

export interface ChatRequestBody {
  message: string;
}

export interface ChatResponse {
  success: true;
  sessionId: string;
  answer: string;
  sources: string[];
}

export interface ChatResult {
  answer: string;
  sources: string[];
  sessionId: string;
}

// ─── Ingest ──────────────────────────────────────────────────────────────────

export interface IngestTextBody {
  text: string;
  source?: string;
}

export interface IngestResult {
  fileName?: string;
  totalChars: number;
  totalChunks: number;
}

export interface IngestResponse {
  success: true;
  message: string;
  fileName?: string;
  totalChars: number;
  totalChunks: number;
}

// ─── Status ──────────────────────────────────────────────────────────────────

export interface StatusResponse {
  status: 'ok';
  vectorStore: 'ready' | 'empty';
  vectorCount: number;
  ts: string;
}

// ─── Session ─────────────────────────────────────────────────────────────────

export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Session {
  history: SessionMessage[];
  createdAt: number;
  lastActive: number;
}

// ─── Config ──────────────────────────────────────────────────────────────────

export interface AppConfig {
  nodeEnv: string;
  port: number;
  gemini: {
    apiKey: string;
    model: string;
    embeddingModel: string;
  };
  cors: {
    allowedOrigins: string[];
  };
  rag: {
    chunkSize: number;
    chunkOverlap: number;
    topK: number;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  bot: {
    name: string;
    systemPrompt: string;
  };
  paths: {
    vectorStore: string;
    uploads: string;
    data: string;
  };
}

// ─── Express extensions ───────────────────────────────────────────────────────

export interface MulterRequest extends Request {
  file?: Express.Multer.File;
}
