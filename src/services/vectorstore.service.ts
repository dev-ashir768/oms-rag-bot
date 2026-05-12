import path from 'path';
import fs from 'fs';
import { HNSWLib } from '@langchain/community/vectorstores/hnswlib';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { Document } from '@langchain/core/documents';
import config from '../config';
import logger from '../utils/logger';

let vectorStore: HNSWLib | null = null;
let embeddings: GoogleGenerativeAIEmbeddings | null = null;

function getEmbeddings(): GoogleGenerativeAIEmbeddings {
  if (!embeddings) {
    embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: config.gemini.apiKey,
      modelName: config.gemini.embeddingModel,
    });
  }
  return embeddings;
}

export async function initVectorStore(): Promise<void> {
  const storePath = config.paths.vectorStore;
  const indexFile = path.join(storePath, 'hnswlib.index');

  if (fs.existsSync(indexFile)) {
    try {
      logger.info('Loading existing vector store from disk...');
      vectorStore = await HNSWLib.load(storePath, getEmbeddings());
      logger.info(`Vector store loaded — ${vectorStore.index.getCurrentCount()} vectors`);
      return;
    } catch (err) {
      logger.warn('Failed to load existing vector store, starting fresh:', (err as Error).message);
    }
  }

  logger.info('No existing vector store — will create on first ingest');
}

export async function addDocuments(docs: Document[]): Promise<void> {
  const storePath = config.paths.vectorStore;

  if (!vectorStore) {
    logger.info(`Creating new vector store with ${docs.length} chunks...`);
    vectorStore = await HNSWLib.fromDocuments(docs, getEmbeddings());
  } else {
    logger.info(`Adding ${docs.length} chunks to existing vector store...`);
    await vectorStore.addDocuments(docs);
  }

  await vectorStore.save(storePath);
  logger.info(`Vector store saved — total: ${vectorStore.index.getCurrentCount()} vectors`);
}

export async function similaritySearch(query: string, k: number = config.rag.topK): Promise<Document[]> {
  if (!vectorStore) throw new Error('Vector store is empty. Ingest documents first.');
  return vectorStore.similaritySearch(query, k);
}

export function getVectorCount(): number {
  return vectorStore?.index.getCurrentCount() ?? 0;
}

export function isReady(): boolean {
  return vectorStore !== null;
}
