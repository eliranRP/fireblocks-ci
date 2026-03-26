import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError } from './errors.js';
import { logger } from '../logger/index.js';

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    logger.warn({ err }, err.message);
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  logger.error({ err }, message);
  res.status(500).json({ error: message });
};
