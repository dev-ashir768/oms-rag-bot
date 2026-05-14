import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { searchRelevantDocs, isReady } from './vectorstore.service';
import { Session, SessionMessage, ChatResult } from '../types';
import config from '../config';
import { SYSTEM_PROMPT } from '../config/prompts';
import logger from '../utils/logger';

// ─── Session store ────────────────────────────────────────────────────────────
const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 30 * 60 * 1000;

// ─── LLM ─────────────────────────────────────────────────────────────────────
const llm = new ChatGoogleGenerativeAI({
  apiKey: config.gemini.apiKey,
  model: config.gemini.model,
  temperature: 0.3,
  maxOutputTokens: 1024,
});

const outputParser = new StringOutputParser();

// ─── Out-of-scope fallback ────────────────────────────────────────────────────
// Returned when no relevant chunks are found above the similarity threshold
const OUT_OF_SCOPE_RESPONSE = `I'm specifically trained to assist with **Orio OMS Dashboard** features and functionality.

For further assistance, please reach out to our team:
- **Website:** [getorio.com](https://getorio.com)
- **Email:** info@getorio.com
- **Phone:** 021-37293292 / 0318-0268894`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function buildContext(docs: import('@langchain/core/documents').Document[]): string {
  if (!docs.length) return '';
  return docs.map((doc, i) => `[Context ${i + 1}]:\n${doc.pageContent}`).join('\n\n---\n\n');
}

// ─── Main chat ────────────────────────────────────────────────────────────────

export async function chat(sessionId: string, userMessage: string): Promise<ChatResult> {
  if (!isReady()) {
    return {
      answer: "I'm not ready yet — no knowledge base loaded. Please contact an admin.",
      sources: [],
      sessionId,
    };
  }

  const session = getOrCreateSession(sessionId);

  // Step 1: Semantic search with threshold filtering
  const { docs: relevantDocs, maxScore } = await searchRelevantDocs(userMessage);

  // Step 2: If no relevant chunks found → return out-of-scope message
  // This prevents hallucination on completely unrelated questions
  if (relevantDocs.length === 0) {
    logger.info(`Out-of-scope query (max score: ${maxScore.toFixed(3)}): "${userMessage.slice(0, 60)}"`);

    // Still save to history so multi-turn context works
    session.history.push({ role: 'user', content: userMessage });
    session.history.push({ role: 'assistant', content: OUT_OF_SCOPE_RESPONSE });
    if (session.history.length > 20) session.history = session.history.slice(-20);

    return { answer: OUT_OF_SCOPE_RESPONSE, sources: [], sessionId };
  }

  // Step 3: Build context from relevant chunks
  const context = buildContext(relevantDocs);
  const historyMessages = buildHistoryMessages(session.history);

  // Step 4: Inject context into system prompt and call Gemini
  const systemContent = SYSTEM_PROMPT.replace('{context}', context);

  const promptMessages = [
    new SystemMessage(systemContent),
    ...historyMessages,
    new HumanMessage(userMessage),
  ];

  const prompt = ChatPromptTemplate.fromMessages(
    promptMessages.map((m) => [m._getType(), m.content]),
  );

  const chain = prompt.pipe(llm).pipe(outputParser);
  const answer = await chain.invoke({});

  // Step 5: Update session history
  session.history.push({ role: 'user', content: userMessage });
  session.history.push({ role: 'assistant', content: answer });
  if (session.history.length > 20) session.history = session.history.slice(-20);

  const sources = [
    ...new Set(relevantDocs.map((d) => d.metadata['source'] as string).filter(Boolean)),
  ];

  return { answer, sources, sessionId };
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function getSessionCount(): number {
  return sessions.size;
}

// Cleanup stale sessions every 10 min
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.lastActive > SESSION_TTL_MS) sessions.delete(id);
  }
}, 10 * 60 * 1000);
