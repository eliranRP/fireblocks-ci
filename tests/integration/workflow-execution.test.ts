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
import type { NodeStatusEvent, StepResultEvent } from '../../src/libraries/events/event-bus.types.js';

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

import * as workflowService from '../../src/components/workflow/workflow.service.js';

beforeAll(() => {
  runMigrations();
  wireListeners();
});

afterAll(() => {
  eventBus.removeAllListeners();
  closeDb();
});

describe('Workflow execution integration', () => {
  it('creates a workflow with jobs and steps', () => {
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
  });

  it('executes a workflow and transitions to success', async () => {
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
    expect(runId).toBeDefined();

    // Wait for async execution to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const status = workflowService.getStatus(workflow.id);
    expect(status.status).toBe('success');
    expect(status.jobs[0]?.status).toBe('success');
    expect(status.jobs[0]?.steps[0]?.status).toBe('success');
  });

  it('stops execution when a step fails — subsequent jobs are skipped', async () => {
    const workflow = workflowService.createWorkflow({
      name: 'Failing Pipeline',
      event: 'push',
      projectId: 'proj-1',
      jobs: [
        {
          name: 'failing-job',
          steps: [
            { name: 'fail', type: 'shell', command: 'exit 1' },
            { name: 'skipped', type: 'shell', command: 'echo never-runs' },
          ],
        },
        {
          name: 'second-job',
          steps: [{ name: 'also-skipped', type: 'shell', command: 'echo also-never' }],
        },
      ],
    });

    workflowService.triggerRun(workflow.id);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const status = workflowService.getStatus(workflow.id);
    expect(status.status).toBe('failed');
    expect(status.jobs[0]?.status).toBe('failed');
    // Second job should still be pending (never ran)
    expect(status.jobs[1]?.status).toBe('pending');
  });
});
