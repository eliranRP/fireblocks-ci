import express from 'express';
import { pinoHttp } from 'pino-http';
import { workflowRouter } from './components/workflow/index.js';
import { jobRouter } from './components/job/index.js';
import { stepRouter } from './components/step/index.js';
import { errorHandler } from './libraries/error-handler/index.js';
import { logger } from './libraries/logger/index.js';
import { eventBus } from './libraries/events/event-bus.js';
import { sseManager } from './libraries/sse/sse-manager.js';
import * as workflowDal from './components/workflow/workflow.dal.js';
import * as jobDal from './components/job/job.dal.js';
import * as stepDal from './components/step/step.dal.js';
import type { NodeStatusEvent, StepResultEvent, RunCompleteEvent } from './libraries/events/event-bus.types.js';

const app = express();

// Middleware
app.use(express.json());
app.use(pinoHttp({ logger }));

// Routes
app.use('/workflows', workflowRouter);
app.use('/jobs', jobRouter);
app.use('/steps', stepRouter);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Wire event-bus listeners — single place where engine events become DB writes + SSE pushes
function wireEventListeners(): void {
  const now = () => new Date().toISOString();

  eventBus.on('node:status', (event: NodeStatusEvent) => {
    const { id, type, status } = event;

    try {
      if (type === 'workflow') {
        workflowDal.updateStatus(id, status as Parameters<typeof workflowDal.updateStatus>[1], {
          started_at: status === 'running' ? now() : undefined,
          finished_at: status === 'success' || status === 'failed' ? now() : undefined,
        });
      } else if (type === 'job') {
        jobDal.updateStatus(id, status as Parameters<typeof jobDal.updateStatus>[1], {
          started_at: status === 'running' ? now() : undefined,
          finished_at: status === 'success' || status === 'failed' ? now() : undefined,
        });
      } else if (type === 'step') {
        stepDal.updateStatus(id, status as Parameters<typeof stepDal.updateStatus>[1], {
          started_at: status === 'running' ? now() : undefined,
          finished_at: status === 'success' || status === 'failed' ? now() : undefined,
        });
      }
    } catch (err) {
      logger.error({ err, event }, 'Failed to persist node:status');
    }
  });

  eventBus.on('step:result', (event: StepResultEvent) => {
    try {
      stepDal.saveResult(event.stepId, {
        status: event.status,
        log: event.log,
        duration_ms: event.duration_ms,
      });
    } catch (err) {
      logger.error({ err, event }, 'Failed to persist step:result');
    }
  });

  eventBus.on('run:complete', (event: RunCompleteEvent) => {
    // Broadcast run completion to all SSE clients subscribed to this runId
    sseManager.broadcast(event.runId, 'run:complete', {
      status: event.status,
      error: event.error,
    });
  });

  eventBus.on('node:status', (event: NodeStatusEvent) => {
    // Also broadcast node status changes to SSE — no runId in event, broadcast by workflowId isn't available here.
    // The SSE channel key is runId; clients should subscribe once they receive the runId from POST /run.
    // We broadcast using the node id as a fallback broadcast key only if clients are subscribed to it.
    sseManager.broadcast(event.id, 'node:status', event);
  });
}

wireEventListeners();

// Central error handler — must be last
app.use(errorHandler);

export { app };
