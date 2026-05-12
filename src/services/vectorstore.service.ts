import fs from 'fs';
import path from 'path';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { Document } from '@langchain/core/documents';
import config from '../config';
import logger from '../utils/logger';

// Pure JS vector store — no native compilation needed
// Vectors are persisted to a JSON file on disk

const STORE_FILE = path.join(config.paths.vectorStore, 'store.json');

let vectorStore: MemoryVectorStore | null = null;
let embeddings: GoogleGenerativeAIEmbeddings | null = null;

interface StoredVector {
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  id?: string;
}

function getEmbeddings(): GoogleGenerativeAIEmbeddings {
  if (!embeddings) {
    embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: config.gemini.apiKey,
      modelName: config.gemini.embeddingModel,
    });
  }
  return embeddings;
}

function saveToFile(): void {
  if (!vectorStore) return;
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify({ vectors: vectorStore.memoryVectors }));
  logger.info(`Vector store saved — ${vectorStore.memoryVectors.length} vectors`);
}

export async function initVectorStore(): Promise<void> {
  if (!fs.existsSync(STORE_FILE)) {
    logger.info('No existing vector store — will create on first ingest');
    return;
  }

  try {
    logger.info('Loading vector store from disk...');
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    const data: { vectors: StoredVector[] } = JSON.parse(raw);

    vectorStore = new MemoryVectorStore(getEmbeddings());
    vectorStore.memoryVectors = data.vectors as typeof vectorStore.memoryVectors;

    logger.info(`Vector store loaded — ${vectorStore.memoryVectors.length} vectors`);
  } catch (err) {
    logger.warn('Failed to load vector store, starting fresh:', (err as Error).message);
  }
}

export async function addDocuments(docs: Document[]): Promise<void> {
  if (!vectorStore) {
    logger.info(`Creating new vector store with ${docs.length} chunks...`);
    vectorStore = await MemoryVectorStore.fromDocuments(docs, getEmbeddings());
  } else {
    logger.info(`Adding ${docs.length} chunks to existing vector store...`);
    await vectorStore.addDocuments(docs);
  }
  saveToFile();
}

export async function similaritySearch(query: string, k: number = config.rag.topK): Promise<Document[]> {
  if (!vectorStore) throw new Error('Vector store is empty. Ingest documents first.');
  return vectorStore.similaritySearch(query, k);
}

export function getVectorCount(): number {
  return vectorStore?.memoryVectors.length ?? 0;
}

export function isReady(): boolean {
  return vectorStore !== null && vectorStore.memoryVectors.length > 0;
}
