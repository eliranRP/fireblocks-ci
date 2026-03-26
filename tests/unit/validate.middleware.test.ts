import { jest } from '@jest/globals';
import { z } from 'zod';
import { validate } from '../../src/libraries/middleware/validate.js';
import { ValidationError } from '../../src/libraries/error-handler/errors.js';
import type { Request, Response, NextFunction } from 'express';

const TestSchema = z.object({
  name: z.string().min(1),
  count: z.number().default(0),
});

function makeReq(body: unknown): Request {
  return { body } as unknown as Request;
}

const res = {} as Response;

describe('validate middleware', () => {
  it('calls next() without error when the body is valid', () => {
    const next = jest.fn() as unknown as NextFunction;
    const req = makeReq({ name: 'hello' });
    validate(TestSchema)(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('replaces req.body with the Zod-parsed value (applies defaults)', () => {
    const next = jest.fn() as unknown as NextFunction;
    const req = makeReq({ name: 'hello' });
    validate(TestSchema)(req, res, next);
    expect(req.body).toEqual({ name: 'hello', count: 0 });
  });

  it('calls next(ValidationError) when the body is invalid', () => {
    const next = jest.fn() as unknown as NextFunction;
    validate(TestSchema)(makeReq({}), res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it('error message contains the Zod issue description', () => {
    const next = jest.fn() as unknown as NextFunction;
    validate(TestSchema)(makeReq({ name: '' }), res, next);
    const err = (next as jest.Mock).mock.calls[0]?.[0] as ValidationError;
    expect(err.message).toMatch(/too_small|at least/i);
  });

  it('calls next(ValidationError) for completely wrong body shape', () => {
    const next = jest.fn() as unknown as NextFunction;
    validate(TestSchema)(makeReq('not an object'), res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });
});
