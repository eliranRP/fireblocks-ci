import { jest } from '@jest/globals';
import { errorHandler } from '../../src/libraries/error-handler/index.js';
import {
  AppError,
  NotFoundError,
  ValidationError,
  CIError,
} from '../../src/libraries/error-handler/errors.js';
import type { Request, Response, NextFunction } from 'express';

function makeRes(): Response {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

const req = {} as Request;
const next = jest.fn() as unknown as NextFunction;

describe('AppError subclasses', () => {
  it('NotFoundError has statusCode 404', () => {
    const err = new NotFoundError('Workflow xyz');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Workflow xyz not found');
    expect(err.name).toBe('NotFoundError');
  });

  it('ValidationError has statusCode 400', () => {
    const err = new ValidationError('name is required');
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('name is required');
  });

  it('CIError has statusCode 500', () => {
    const err = new CIError('execution failed');
    expect(err.statusCode).toBe(500);
  });

  it('AppError propagates statusCode and name', () => {
    const err = new AppError('custom', 418);
    expect(err.statusCode).toBe(418);
    expect(err.name).toBe('AppError');
  });
});

describe('errorHandler middleware', () => {
  it('responds with AppError statusCode and message for NotFoundError', () => {
    const res = makeRes();
    errorHandler(new NotFoundError('Workflow abc'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Workflow abc not found' });
  });

  it('responds with 400 and message for ValidationError', () => {
    const res = makeRes();
    errorHandler(new ValidationError('jobs is required'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'jobs is required' });
  });

  it('responds with 500 and generic message for plain Error', () => {
    const res = makeRes();
    errorHandler(new Error('db connection lost'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });

  it('responds with 500 and generic message for non-Error thrown values', () => {
    const res = makeRes();
    errorHandler('something broke', req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
