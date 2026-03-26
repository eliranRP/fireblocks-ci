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

app.use(express.json());
app.use(pinoHttp({ logger }));

app.use('/workflows', workflowRouter);
app.use('/jobs', jobRouter);
app.use('/steps', stepRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

function now(): string {
  return new Date().toISOString();
}

function timestampsFor(status: NodeStatusEvent['status']): { started_at?: string; finished_at?: string } {
  return {
    started_at: status === 'running' ? now() : undefined,
    finished_at: status === 'success' || status === 'failed' ? now() : undefined,
  };
}

// Single place where engine events become DB writes + SSE pushes.
// Deliberately explicit — the engine knows nothing about persistence or HTTP.
export function wireEventListeners(): void {
  eventBus.on('node:status', (event: NodeStatusEvent) => {
    const { id, type, status, runId } = event;
    const timestamps = timestampsFor(status);

    try {
      if (type === 'workflow') {
        workflowDal.updateStatus(id, status, timestamps);
      } else if (type === 'job') {
        jobDal.updateStatus(id, status, timestamps);
      } else if (type === 'step') {
        stepDal.updateStatus(id, status, timestamps);
      }
    } catch (err) {
      logger.error({ err, event }, 'Failed to persist node:status');
    }

    sseManager.broadcast(runId, 'node:status', { id, type, status });
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
    sseManager.broadcast(event.runId, 'run:complete', {
      status: event.status,
      error: event.error,
    });
  });
}

wireEventListeners();

app.use(errorHandler);

export { app };
