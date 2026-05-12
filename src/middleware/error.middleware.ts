import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
}

export default function errorMiddleware(
  err: HttpError,
  req: Request,
  res: Response,
  // next must be declared even if unused — Express requires 4 params to detect error handler
  _next: NextFunction,
): void {
  logger.error(err.message, { stack: err.stack, path: req.path });

  const status = err.status ?? err.statusCode ?? 500;
  const message =
    process.env.NODE_ENV === 'production' && status === 500 ? 'Internal server error' : err.message;

  res.status(status).json({ error: message });
}
