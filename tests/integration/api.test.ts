process.env['DB_PATH'] = ':memory:';
process.env['WORK_DIR'] = '/tmp';

import request from 'supertest';
import { app, wireEventListeners } from '../../src/app.js';
import { runMigrations } from '../../scripts/migrate.js';
import { closeDb } from '../../src/libraries/db/db.js';
import { eventBus } from '../../src/libraries/events/event-bus.js';
import type { RunCompleteEvent } from '../../src/libraries/events/event-bus.types.js';

function waitForRun(runId: string, timeoutMs = 5000): Promise<RunCompleteEvent> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      eventBus.off('run:complete', handler);
      reject(new Error(`run:complete not received for runId=${runId} within ${timeoutMs}ms`));
    }, timeoutMs);
    const handler = (event: RunCompleteEvent) => {
      if (event.runId === runId) {
        clearTimeout(timer);
        eventBus.off('run:complete', handler);
        resolve(event);
      }
    };
    eventBus.on('run:complete', handler);
  });
}

const validWorkflowBody = {
  name: 'CI Pipeline',
  event: 'push',
  projectId: 'proj-1',
  jobs: [
    {
      name: 'build',
      steps: [
        { name: 'compile', type: 'shell', command: 'echo building' },
      ],
    },
  ],
};

beforeAll(() => {
  runMigrations();
  wireEventListeners();
});

afterAll(() => {
  eventBus.removeAllListeners();
  closeDb();
});

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

// ---------------------------------------------------------------------------
// POST /workflows — validation + creation
// ---------------------------------------------------------------------------

describe('POST /workflows', () => {
  it('returns 201 with the created workflow', async () => {
    const res = await request(app).post('/workflows').send(validWorkflowBody);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('pending');
    expect(res.body.name).toBe('CI Pipeline');
  });

  it('applies Zod defaults (event defaults to push)', async () => {
    const res = await request(app)
      .post('/workflows')
      .send({ name: 'No-event Pipeline', jobs: [{ name: 'j', steps: [{ name: 's', command: 'echo x' }] }] });
    expect(res.status).toBe(201);
    expect(res.body.event).toBe('push');
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/workflows')
      .send({ jobs: [{ name: 'j', steps: [{ name: 's', command: 'echo x' }] }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when jobs array is empty', async () => {
    const res = await request(app).post('/workflows').send({ name: 'p', jobs: [] });
    expect(res.status).toBe(400);
  });

  it('returns 400 when a step has no command', async () => {
    const res = await request(app)
      .post('/workflows')
      .send({ name: 'p', jobs: [{ name: 'j', steps: [{ name: 's' }] }] });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /workflows/:id/run
// ---------------------------------------------------------------------------

describe('POST /workflows/:id/run', () => {
  it('returns 202 with a runId', async () => {
    const create = await request(app).post('/workflows').send(validWorkflowBody);
    const run = await request(app).post(`/workflows/${create.body.id}/run`);
    expect(run.status).toBe(202);
    expect(run.body.runId).toBeDefined();
    await waitForRun(run.body.runId);
  });

  it('returns 404 for a nonexistent workflow id', async () => {
    const res = await request(app).post('/workflows/does-not-exist/run');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /workflows/:id/status
// ---------------------------------------------------------------------------

describe('GET /workflows/:id/status', () => {
  it('returns the workflow with jobs and steps after creation', async () => {
    const create = await request(app).post('/workflows').send(validWorkflowBody);
    const status = await request(app).get(`/workflows/${create.body.id}/status`);
    expect(status.status).toBe(200);
    expect(status.body.jobs).toHaveLength(1);
    expect(status.body.jobs[0].steps).toHaveLength(1);
  });

  it('reflects success status after a run completes', async () => {
    const create = await request(app).post('/workflows').send(validWorkflowBody);
    const run = await request(app).post(`/workflows/${create.body.id}/run`);
    await waitForRun(run.body.runId);

    const status = await request(app).get(`/workflows/${create.body.id}/status`);
    expect(status.body.status).toBe('success');
    expect(status.body.jobs[0].status).toBe('success');
    expect(status.body.jobs[0].steps[0].status).toBe('success');
  });

  it('reflects failed status after a failing run', async () => {
    const create = await request(app).post('/workflows').send({
      name: 'Fail Pipeline',
      jobs: [{ name: 'j', steps: [{ name: 'fail', command: 'exit 1' }] }],
    });
    const run = await request(app).post(`/workflows/${create.body.id}/run`);
    await waitForRun(run.body.runId);

    const status = await request(app).get(`/workflows/${create.body.id}/status`);
    expect(status.body.status).toBe('failed');
  });

  it('returns 404 for a nonexistent workflow id', async () => {
    const res = await request(app).get('/workflows/nonexistent/status');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// GET /jobs/:id and GET /jobs/workflow/:workflowId
// ---------------------------------------------------------------------------

describe('GET /jobs', () => {
  let workflowId: string;
  let jobId: string;

  beforeAll(async () => {
    const res = await request(app).post('/workflows').send(validWorkflowBody);
    workflowId = res.body.id as string;
    const status = await request(app).get(`/workflows/${workflowId}/status`);
    jobId = status.body.jobs[0].id as string;
  });

  it('GET /jobs/:id returns the job', async () => {
    const res = await request(app).get(`/jobs/${jobId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(jobId);
    expect(res.body.name).toBe('build');
  });

  it('GET /jobs/workflow/:workflowId returns jobs for the workflow', async () => {
    const res = await request(app).get(`/jobs/workflow/${workflowId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].steps).toBeDefined();
  });

  it('GET /jobs/:id returns 404 for unknown id', async () => {
    const res = await request(app).get('/jobs/nonexistent');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /steps/:id and GET /steps/:id/logs
// ---------------------------------------------------------------------------

describe('GET /steps', () => {
  let stepId: string;
  let workflowId: string;

  beforeAll(async () => {
    const create = await request(app).post('/workflows').send(validWorkflowBody);
    workflowId = create.body.id as string;
    const run = await request(app).post(`/workflows/${workflowId}/run`);
    await waitForRun(run.body.runId);
    const status = await request(app).get(`/workflows/${workflowId}/status`);
    stepId = status.body.jobs[0].steps[0].id as string;
  });

  it('GET /steps/:id returns the step', async () => {
    const res = await request(app).get(`/steps/${stepId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(stepId);
  });

  it('GET /steps/:id/logs returns the captured log', async () => {
    const res = await request(app).get(`/steps/${stepId}/logs`);
    expect(res.status).toBe(200);
    expect(res.body.log).toContain('building');
  });

  it('GET /steps/:id returns 404 for unknown id', async () => {
    const res = await request(app).get('/steps/nonexistent');
    expect(res.status).toBe(404);
  });

  it('GET /steps/:id/logs returns 404 for unknown id', async () => {
    const res = await request(app).get('/steps/nonexistent/logs');
    expect(res.status).toBe(404);
  });
});
