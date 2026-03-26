import { closeDb } from '../../src/libraries/db/db.js';
import { runMigrations } from '../../scripts/migrate.js';
import { eventBus } from '../../src/libraries/events/event-bus.js';
import { wireEventListeners } from '../../src/app.js';
import { sseManager } from '../../src/libraries/sse/sse-manager.js';

// Use in-memory DB and a real temp dir for integration tests
process.env['DB_PATH'] = ':memory:';
process.env['WORK_DIR'] = '/tmp';

import type { RunCompleteEvent } from '../../src/libraries/events/event-bus.types.js';

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
  wireEventListeners();
});

afterAll(() => {
  eventBus.removeAllListeners();
  sseManager.removeAllClients();
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

// ---------------------------------------------------------------------------
// Parallel job execution (position-based grouping in buildExecutionTree)
// ---------------------------------------------------------------------------

describe('Parallel job execution', () => {
  it('two jobs with the same position both succeed and the workflow succeeds', async () => {
    const workflow = workflowService.createWorkflow({
      name: 'Parallel Success',
      event: 'push',
      projectId: 'proj-parallel',
      jobs: [
        { name: 'job-a', position: 0, steps: [{ name: 'run', type: 'shell', command: 'echo job-a' }] },
        { name: 'job-b', position: 0, steps: [{ name: 'run', type: 'shell', command: 'echo job-b' }] },
      ],
    });

    const runId = workflowService.triggerRun(workflow.id);
    const result = await waitForRun(runId);

    expect(result.status).toBe('success');

    const status = workflowService.getStatus(workflow.id);
    expect(status.status).toBe('success');
    expect(status.jobs.every((j) => j.status === 'success')).toBe(true);
  });

  it('when one parallel job fails the workflow fails, and a subsequent sequential stage is skipped', async () => {
    const workflow = workflowService.createWorkflow({
      name: 'Parallel Failure + Sequential Skip',
      event: 'push',
      projectId: 'proj-parallel',
      jobs: [
        // Stage 0: two parallel jobs — one will fail
        { name: 'job-pass', position: 0, steps: [{ name: 'run', type: 'shell', command: 'echo ok' }] },
        { name: 'job-fail', position: 0, steps: [{ name: 'run', type: 'shell', command: 'exit 1' }] },
        // Stage 1: sequential job that should never start
        { name: 'job-after', position: 1, steps: [{ name: 'run', type: 'shell', command: 'echo after' }] },
      ],
    });

    const runId = workflowService.triggerRun(workflow.id);
    const result = await waitForRun(runId);

    expect(result.status).toBe('failed');

    const status = workflowService.getStatus(workflow.id);
    expect(status.status).toBe('failed');

    // The sequential stage-1 job was never started
    const afterJob = status.jobs.find((j) => j.name === 'job-after');
    expect(afterJob?.status).toBe('pending');
  });

  it('sequential jobs with explicit positions run in order and all succeed', async () => {
    const workflow = workflowService.createWorkflow({
      name: 'Explicit Sequential Positions',
      event: 'push',
      projectId: 'proj-parallel',
      jobs: [
        { name: 'first',  position: 0, steps: [{ name: 'run', type: 'shell', command: 'echo first' }] },
        { name: 'second', position: 1, steps: [{ name: 'run', type: 'shell', command: 'echo second' }] },
        { name: 'third',  position: 2, steps: [{ name: 'run', type: 'shell', command: 'echo third' }] },
      ],
    });

    const runId = workflowService.triggerRun(workflow.id);
    const result = await waitForRun(runId);

    expect(result.status).toBe('success');

    const status = workflowService.getStatus(workflow.id);
    expect(status.jobs.every((j) => j.status === 'success')).toBe(true);
  });
});
