import 'dotenv/config';
import path from 'path';
import { initVectorStore } from '../src/services/vectorstore.service';
import { ingestFile } from '../src/services/ingest.service';
import logger from '../src/utils/logger';

async function main(): Promise<void> {
  const filePath = process.argv[2] ?? path.join(__dirname, '../data/knowledge.txt');

  logger.info(`Starting ingest: ${filePath}`);
  await initVectorStore();

  const result = await ingestFile(filePath);
  logger.info('Ingest complete:', result);
  process.exit(0);
}

main().catch((err: Error) => {
  logger.error('Ingest failed:', err);
  process.exit(1);
});
