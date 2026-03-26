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
    // AppError messages are safe to surface — they are written by us, not from external systems
    logger.warn({ err }, err.message);
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Unknown errors may contain internal paths, SQL details, or stack traces.
  // Log the full error for debugging; return only a generic message to the caller.
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
};
