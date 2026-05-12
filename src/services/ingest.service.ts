import path from 'path';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { addDocuments } from './vectorstore.service';
import { parseFile } from '../utils/fileParser';
import { IngestResult } from '../types';
import config from '../config';
import logger from '../utils/logger';

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: config.rag.chunkSize,
  chunkOverlap: config.rag.chunkOverlap,
  separators: ['\n\n', '\n', '. ', '! ', '? ', ' ', ''],
});

function buildDocs(chunks: string[], metadata: Record<string, unknown>): Document[] {
  return chunks.map((chunk, idx) =>
    new Document({
      pageContent: chunk,
      metadata: {
        chunkIndex: idx,
        totalChunks: chunks.length,
        ingestedAt: new Date().toISOString(),
        ...metadata,
      },
    }),
  );
}

export async function ingestFile(
  filePath: string,
  metadata: Record<string, unknown> = {},
): Promise<IngestResult> {
  logger.info(`Ingesting file: ${filePath}`);

  const rawText = await parseFile(filePath);
  if (!rawText || rawText.trim().length === 0) throw new Error('File is empty or could not be parsed');

  logger.info(`Parsed ${rawText.length} characters`);

  const chunks = await splitter.splitText(rawText);
  logger.info(`Split into ${chunks.length} chunks`);

  const docs = buildDocs(chunks, { source: filePath, ...metadata });
  await addDocuments(docs);

  return {
    fileName: path.basename(filePath),
    totalChars: rawText.length,
    totalChunks: chunks.length,
  };
}

export async function ingestText(
  text: string,
  metadata: Record<string, unknown> = {},
): Promise<IngestResult> {
  if (!text || text.trim().length === 0) throw new Error('Text content is empty');

  const chunks = await splitter.splitText(text);
  logger.info(`Split text into ${chunks.length} chunks`);

  const docs = buildDocs(chunks, { source: 'direct-text', ...metadata });
  await addDocuments(docs);

  return { totalChars: text.length, totalChunks: chunks.length };
}
