import cors, { CorsOptions } from 'cors';
import config from '../config';

const allowAll = config.cors.allowedOrigins.includes('*');

const corsOptions: CorsOptions = {
  origin: allowAll
    ? '*'
    : (origin, callback) => {
        if (!origin || config.cors.allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: Origin ${origin} not allowed`));
        }
      },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id'],
  credentials: !allowAll,
};

export default cors(corsOptions);
