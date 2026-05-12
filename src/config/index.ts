import path from 'path';
import { AppConfig } from '../types';

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

const config: AppConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  gemini: {
    apiKey: required('GEMINI_API_KEY'),
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004',
  },

  cors: {
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '*').split(',').map((o) => o.trim()),
  },

  rag: {
    chunkSize: parseInt(process.env.CHUNK_SIZE || '1000', 10),
    chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || '200', 10),
    topK: parseInt(process.env.TOP_K_RESULTS || '4', 10),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '30', 10),
  },

  bot: {
    name: process.env.BOT_NAME || 'Assistant',
    systemPrompt:
      process.env.BOT_SYSTEM_PROMPT ||
      "You are a helpful assistant. Answer questions based only on the provided context. If the answer is not in the context, politely say you don't have that information. Be concise, friendly, and professional.",
  },

  paths: {
    vectorStore: path.join(process.cwd(), 'vectorstore'),
    uploads: path.join(process.cwd(), 'uploads'),
    data: path.join(process.cwd(), 'data'),
  },
};

export default config;
