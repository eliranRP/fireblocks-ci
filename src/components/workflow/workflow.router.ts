import { Router } from 'express';
import { z } from 'zod';
import * as workflowService from './workflow.service.js';
import { ValidationError } from '../../libraries/error-handler/errors.js';
import { sseManager } from '../../libraries/sse/sse-manager.js';

export const workflowRouter = Router();

const StepSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['shell', 'run_script', 'docker_run']).default('shell'),
  command: z.string().min(1),
});

const JobSchema = z.object({
  name: z.string().min(1),
  steps: z.array(StepSchema).min(1),
});

const CreateWorkflowSchema = z.object({
  name: z.string().min(1),
  event: z.string().default('push'),
  projectId: z.string().default(''),
  jobs: z.array(JobSchema).min(1),
});

// POST /workflows — create a workflow definition
workflowRouter.post('/', (req, res, next) => {
  try {
    const result = CreateWorkflowSchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.issues.map((i) => i.message).join(', '));
    }
    const workflow = workflowService.createWorkflow(result.data);
    res.status(201).json(workflow);
  } catch (err) {
    next(err);
  }
});

// POST /workflows/:id/run — trigger execution
workflowRouter.post('/:id/run', (req, res, next) => {
  try {
    const runId = workflowService.triggerRun(req.params['id']!);
    res.status(202).json({ runId });
  } catch (err) {
    next(err);
  }
});

// GET /workflows/:id/status — full status with jobs and steps
workflowRouter.get('/:id/status', (req, res, next) => {
  try {
    const status = workflowService.getStatus(req.params['id']!);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

// GET /workflows/:id/events — SSE stream for a workflow run
workflowRouter.get('/:id/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const runId = req.params['id']!;
  sseManager.addClient(runId, res);
  req.on('close', () => sseManager.removeClient(runId, res));
});
