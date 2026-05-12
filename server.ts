import 'dotenv/config';
import app from './src/app';
import logger from './src/utils/logger';
import config from './src/config';
import { initVectorStore } from './src/services/vectorstore.service';

async function bootstrap(): Promise<void> {
  logger.info('Initializing vector store...');
  await initVectorStore();
  logger.info('Vector store ready');

  app.listen(config.port, () => {
    logger.info(`RAG Bot running on http://localhost:${config.port} [${config.nodeEnv}]`);
    logger.info(`Widget:  http://localhost:${config.port}/widget/chatbot-widget.js`);
    logger.info(`Status:  http://localhost:${config.port}/api/status`);
  });
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason as Error);
  process.exit(1);
});

process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

bootstrap().catch((err: Error) => {
  logger.error('Bootstrap failed:', err);
  process.exit(1);
});
