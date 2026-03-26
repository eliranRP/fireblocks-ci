import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../error-handler/errors.js';

/**
 * Express middleware factory that validates req.body against a Zod schema.
 * On success, replaces req.body with the parsed (coerced + defaulted) value.
 * On failure, passes a ValidationError to next() for the central error handler.
 */
export function validate<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new ValidationError(result.error.issues.map((i) => i.message).join(', ')));
    }
    req.body = result.data;
    next();
  };
}
