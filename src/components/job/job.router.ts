import { Router } from 'express';
import * as jobService from './job.service.js';

export const jobRouter = Router();

// GET /jobs/:id — get a single job
jobRouter.get('/:id', (req, res, next) => {
  try {
    const job = jobService.getJob(req.params['id']!);
    res.json(job);
  } catch (err) {
    next(err);
  }
});

// GET /workflows/:workflowId/jobs — list jobs for a workflow
jobRouter.get('/workflow/:workflowId', (req, res, next) => {
  try {
    const jobs = jobService.getJobsForWorkflow(req.params['workflowId']!);
    res.json(jobs);
  } catch (err) {
    next(err);
  }
});
