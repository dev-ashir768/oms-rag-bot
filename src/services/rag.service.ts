import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { Document } from '@langchain/core/documents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { similaritySearch, isReady } from './vectorstore.service';
import { Session, SessionMessage, ChatResult } from '../types';
import config from '../config';
import logger from '../utils/logger';

// ─── In-memory session store ─────────────────────────────────────────────────
// sessionId → Session (history + timestamps)
const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ─── LLM ─────────────────────────────────────────────────────────────────────
const llm = new ChatGoogleGenerativeAI({
  apiKey: config.gemini.apiKey,
  model: config.gemini.model,
  temperature: 0.3,
  maxOutputTokens: 1024,
});

const outputParser = new StringOutputParser();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getOrCreateSession(sessionId: string): Session {
  let session = sessions.get(sessionId);
  if (!session) {
    session = { history: [], createdAt: Date.now(), lastActive: Date.now() };
    sessions.set(sessionId, session);
  } else {
    session.lastActive = Date.now();
  }
  return session;
}

function buildHistoryMessages(history: SessionMessage[]) {
  return history.flatMap(({ role, content }) =>
    role === 'user' ? [new HumanMessage(content)] : [new AIMessage(content)],
  );
}

function buildContext(docs: Document[]): string {
  if (!docs.length) return 'No relevant context found.';
  return docs.map((doc, i) => `[Context ${i + 1}]:\n${doc.pageContent}`).join('\n\n---\n\n');
}

// ─── Main chat function ───────────────────────────────────────────────────────

export async function chat(sessionId: string, userMessage: string): Promise<ChatResult> {
  // Bot not ready yet — no documents ingested
  if (!isReady()) {
    return {
      answer:
        "I'm not ready yet — no knowledge base has been loaded. Please ask an admin to ingest documents first.",
      sources: [],
      sessionId,
    };
  }

  const session = getOrCreateSession(sessionId);

  // Step 1: Find relevant chunks from vector store
  const relevantDocs = await similaritySearch(userMessage);
  logger.debug(`Retrieved ${relevantDocs.length} chunks for: "${userMessage}"`);

  // Step 2: Build context string from retrieved chunks
  const context = buildContext(relevantDocs);

  // Step 3: Build history messages for multi-turn conversation
  const historyMessages = buildHistoryMessages(session.history);

  // Step 4: Build the full prompt
  const promptMessages = [
    new SystemMessage(
      `${config.bot.systemPrompt}\n\nUse the following context to answer:\n\n${context}`,
    ),
    ...historyMessages,
    new HumanMessage(userMessage),
  ];

  const prompt = ChatPromptTemplate.fromMessages(promptMessages.map((m) => [m._getType(), m.content]));

  // Step 5: Call Gemini and parse response
  const chain = prompt.pipe(llm).pipe(outputParser);
  const answer = await chain.invoke({});

  // Step 6: Save to session history (keep last 20 messages = 10 turns)
  session.history.push({ role: 'user', content: userMessage });
  session.history.push({ role: 'assistant', content: answer });
  if (session.history.length > 20) session.history = session.history.slice(-20);

  const sources = [...new Set(relevantDocs.map((d) => d.metadata['source'] as string).filter(Boolean))];

  return { answer, sources, sessionId };
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function getSessionCount(): number {
  return sessions.size;
}

// Cleanup stale sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.lastActive > SESSION_TTL_MS) sessions.delete(id);
  }
}, 10 * 60 * 1000);
