import { Router } from 'express';
import * as stepService from './step.service.js';

export const stepRouter = Router();

// GET /steps/:id — get step details
stepRouter.get('/:id', (req, res, next) => {
  try {
    const step = stepService.getStep(req.params['id']!);
    res.json(step);
  } catch (err) {
    next(err);
  }
});

// GET /steps/:id/logs — get step log output
stepRouter.get('/:id/logs', (req, res, next) => {
  try {
    const log = stepService.getStepLog(req.params['id']!);
    res.json({ log });
  } catch (err) {
    next(err);
  }
});
