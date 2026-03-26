import { closeDb } from '../../src/libraries/db/db.js';
import { runMigrations } from '../../scripts/migrate.js';
import { eventBus } from '../../src/libraries/events/event-bus.js';

// Use in-memory DB and a real temp dir for integration tests
process.env['DB_PATH'] = ':memory:';
process.env['WORK_DIR'] = '/tmp';

// Wire listeners the same way app.ts does
import * as workflowDal from '../../src/components/workflow/workflow.dal.js';
import * as jobDal from '../../src/components/job/job.dal.js';
import * as stepDal from '../../src/components/step/step.dal.js';
import type { NodeStatusEvent, StepResultEvent, RunCompleteEvent } from '../../src/libraries/events/event-bus.types.js';

function wireListeners() {
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
    } catch { /* ignore during test */ }
  });

  eventBus.on('step:result', (event: StepResultEvent) => {
    try {
      stepDal.saveResult(event.stepId, {
        status: event.status,
        log: event.log,
        duration_ms: event.duration_ms,
      });
    } catch { /* ignore during test */ }
  });
}

/** Resolves when the run identified by runId emits run:complete, or rejects after timeoutMs. */
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

import * as workflowService from '../../src/components/workflow/workflow.service.js';

beforeAll(() => {
  runMigrations();
  wireListeners();
});

afterAll(() => {
  eventBus.removeAllListeners();
  closeDb();
});

// ---------------------------------------------------------------------------
// Workflow creation
// ---------------------------------------------------------------------------

describe('Workflow creation', () => {
  it('creates a workflow in pending state with the correct metadata', () => {
    const workflow = workflowService.createWorkflow({
      name: 'Test Pipeline',
      event: 'push',
      projectId: 'proj-1',
      jobs: [
        {
          name: 'build',
          steps: [
            { name: 'echo', type: 'shell', command: 'echo hello' },
          ],
        },
      ],
    });

    expect(workflow.id).toBeDefined();
    expect(workflow.status).toBe('pending');
    expect(workflow.name).toBe('Test Pipeline');
    expect(workflow.event).toBe('push');
    expect(workflow.project_id).toBe('proj-1');
  });

  it('persists jobs and steps so getStatus returns them', () => {
    const workflow = workflowService.createWorkflow({
      name: 'Multi-step Pipeline',
      event: 'push',
      projectId: 'proj-2',
      jobs: [
        {
          name: 'job-a',
          steps: [
            { name: 'step-1', type: 'shell', command: 'echo 1' },
            { name: 'step-2', type: 'shell', command: 'echo 2' },
          ],
        },
        {
          name: 'job-b',
          steps: [
            { name: 'step-3', type: 'shell', command: 'echo 3' },
          ],
        },
      ],
    });

    const status = workflowService.getStatus(workflow.id);
    expect(status.jobs).toHaveLength(2);
    expect(status.jobs[0]?.steps).toHaveLength(2);
    expect(status.jobs[1]?.steps).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Successful execution
// ---------------------------------------------------------------------------

describe('Successful workflow execution', () => {
  it('transitions workflow, job, and step to success', async () => {
    const workflow = workflowService.createWorkflow({
      name: 'Success Pipeline',
      event: 'push',
      projectId: 'proj-1',
      jobs: [
        {
          name: 'job1',
          steps: [{ name: 'step1', type: 'shell', command: 'echo ok' }],
        },
      ],
    });

    const runId = workflowService.triggerRun(workflow.id);
    const result = await waitForRun(runId);

    expect(result.status).toBe('success');

    const status = workflowService.getStatus(workflow.id);
    expect(status.status).toBe('success');
    expect(status.jobs[0]?.status).toBe('success');
    expect(status.jobs[0]?.steps[0]?.status).toBe('success');
  });

  it('captures step log output', async () => {
    const workflow = workflowService.createWorkflow({
      name: 'Log Capture Pipeline',
      event: 'push',
      projectId: 'proj-1',
      jobs: [
        {
          name: 'job1',
          steps: [{ name: 'greet', type: 'shell', command: 'echo hello-world' }],
        },
      ],
    });

    const runId = workflowService.triggerRun(workflow.id);
    await waitForRun(runId);

    const status = workflowService.getStatus(workflow.id);
    expect(status.jobs[0]?.steps[0]?.log).toContain('hello-world');
  });

  it('all steps in a multi-step job succeed sequentially', async () => {
    const workflow = workflowService.createWorkflow({
      name: 'Multi-step Success',
      event: 'push',
      projectId: 'proj-1',
      jobs: [
        {
          name: 'build',
          steps: [
            { name: 'step-a', type: 'shell', command: 'echo a' },
            { name: 'step-b', type: 'shell', command: 'echo b' },
            { name: 'step-c', type: 'shell', command: 'echo c' },
          ],
        },
      ],
    });

    const runId = workflowService.triggerRun(workflow.id);
    await waitForRun(runId);

    const status = workflowService.getStatus(workflow.id);
    expect(status.status).toBe('success');
    for (const step of status.jobs[0]!.steps) {
      expect(step.status).toBe('success');
    }
  });

  it('all jobs in a multi-job pipeline succeed', async () => {
    const workflow = workflowService.createWorkflow({
      name: 'Multi-job Success',
      event: 'push',
      projectId: 'proj-1',
      jobs: [
        { name: 'lint',  steps: [{ name: 'lint',  type: 'shell', command: 'echo linting' }] },
        { name: 'build', steps: [{ name: 'build', type: 'shell', command: 'echo building' }] },
        { name: 'test',  steps: [{ name: 'test',  type: 'shell', command: 'echo testing' }] },
      ],
    });

    const runId = workflowService.triggerRun(workflow.id);
    await waitForRun(runId);

    const status = workflowService.getStatus(workflow.id);
    expect(status.status).toBe('success');
    for (const job of status.jobs) {
      expect(job.status).toBe('success');
    }
  });
});

// ---------------------------------------------------------------------------
// Failure propagation
// ---------------------------------------------------------------------------

describe('Failure propagation', () => {
  it('stops execution when the first step fails — remaining steps stay pending', async () => {
    const workflow = workflowService.createWorkflow({
      name: 'First Step Fails',
      event: 'push',
      projectId: 'proj-1',
      jobs: [
        {
          name: 'failing-job',
          steps: [
            { name: 'fail',    type: 'shell', command: 'exit 1' },
            { name: 'skipped', type: 'shell', command: 'echo never-runs' },
          ],
        },
      ],
    });

    const runId = workflowService.triggerRun(workflow.id);
    await waitForRun(runId);

    const status = workflowService.getStatus(workflow.id);
    expect(status.status).toBe('failed');
    expect(status.jobs[0]?.status).toBe('failed');
    expect(status.jobs[0]?.steps[0]?.status).toBe('failed');
    expect(status.jobs[0]?.steps[1]?.status).toBe('pending');
  });

  it('stops execution when a middle step fails — subsequent jobs stay pending', async () => {
    const workflow = workflowService.createWorkflow({
      name: 'Middle Step Fails',
      event: 'push',
      projectId: 'proj-1',
      jobs: [
        {
          name: 'failing-job',
          steps: [
            { name: 'pass',    type: 'shell', command: 'echo ok' },
            { name: 'fail',    type: 'shell', command: 'exit 1' },
            { name: 'skipped', type: 'shell', command: 'echo skipped' },
          ],
        },
        {
          name: 'second-job',
          steps: [{ name: 'also-skipped', type: 'shell', command: 'echo also-never' }],
        },
      ],
    });

    const runId = workflowService.triggerRun(workflow.id);
    await waitForRun(runId);

    const status = workflowService.getStatus(workflow.id);
    expect(status.status).toBe('failed');
    // First job failed
    expect(status.jobs[0]?.status).toBe('failed');
    // Step before failure succeeded
    expect(status.jobs[0]?.steps[0]?.status).toBe('success');
    // Failing step
    expect(status.jobs[0]?.steps[1]?.status).toBe('failed');
    // Step after failure was never executed
    expect(status.jobs[0]?.steps[2]?.status).toBe('pending');
    // Subsequent job was never executed
    expect(status.jobs[1]?.status).toBe('pending');
  });

  it('when the first job succeeds but the second job fails, workflow is failed', async () => {
    const workflow = workflowService.createWorkflow({
      name: 'Second Job Fails',
      event: 'push',
      projectId: 'proj-1',
      jobs: [
        {
          name: 'job-pass',
          steps: [{ name: 'pass', type: 'shell', command: 'echo ok' }],
        },
        {
          name: 'job-fail',
          steps: [{ name: 'fail', type: 'shell', command: 'exit 1' }],
        },
      ],
    });

    const runId = workflowService.triggerRun(workflow.id);
    await waitForRun(runId);

    const status = workflowService.getStatus(workflow.id);
    expect(status.status).toBe('failed');
    expect(status.jobs[0]?.status).toBe('success');
    expect(status.jobs[1]?.status).toBe('failed');
  });

  it('run:complete carries failed status on failure', async () => {
    const workflow = workflowService.createWorkflow({
      name: 'Event Check Failure',
      event: 'push',
      projectId: 'proj-1',
      jobs: [
        {
          name: 'failing-job',
          steps: [{ name: 'fail', type: 'shell', command: 'exit 1' }],
        },
      ],
    });

    const runId = workflowService.triggerRun(workflow.id);
    const result = await waitForRun(runId);

    expect(result.status).toBe('failed');
    expect(result.runId).toBe(runId);
  });
});
