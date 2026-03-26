import { WorkflowComposite } from '../../src/engine/composite/workflow-composite.js';
import { JobComposite } from '../../src/engine/composite/job-composite.js';
import { StepLeaf } from '../../src/engine/composite/step-leaf.js';
import type { ICommand } from '../../src/engine/commands/command.interface.js';
import type { RunContext } from '../../src/engine/context.js';
import { eventBus } from '../../src/libraries/events/event-bus.js';

// Minimal ICommand stub that succeeds or throws on demand
function makeCommand(shouldFail = false): ICommand {
  return {
    execute: async () => {
      if (shouldFail) throw new Error('command failed');
    },
    toJSON: () => ({ type: 'run_script', script: '', workDir: '' }),
  };
}

function makeCtx(): RunContext {
  return { runId: 'r1', workflowId: 'wf-1', workDir: '/tmp', env: {}, status: 'pending', logs: [] };
}

// Run a composite node, swallowing the re-throw (RunningState always re-throws on failure).
// Returns the context so assertions can be made against the final state.
async function runSafe(node: WorkflowComposite | JobComposite, ctx: RunContext): Promise<void> {
  try {
    await node.run(ctx);
  } catch {
    // expected — RunningState re-throws so the error propagates; ctx.status is already 'failed'
  }
}

beforeEach(() => {
  eventBus.removeAllListeners();
});

// ---------------------------------------------------------------------------
// JobComposite
// ---------------------------------------------------------------------------

describe('JobComposite — sequential step execution', () => {
  it('runs all steps when every step succeeds', async () => {
    const executed: string[] = [];
    const makeTracked = (id: string): ICommand => ({
      execute: async () => { executed.push(id); },
      toJSON: () => ({ type: 'run_script', script: '', workDir: '' }),
    });

    const job = new JobComposite('job-1', 'build', [
      new StepLeaf('s1', 'step-1', makeTracked('s1')),
      new StepLeaf('s2', 'step-2', makeTracked('s2')),
      new StepLeaf('s3', 'step-3', makeTracked('s3')),
    ]);

    await job.run(makeCtx());
    expect(executed).toEqual(['s1', 's2', 's3']);
  });

  it('stops after a failing step — subsequent steps do not execute', async () => {
    const executed: string[] = [];
    const makeTracked = (id: string, fail = false): ICommand => ({
      execute: async () => {
        executed.push(id);
        if (fail) throw new Error('step failed');
      },
      toJSON: () => ({ type: 'run_script', script: '', workDir: '' }),
    });

    const job = new JobComposite('job-1', 'build', [
      new StepLeaf('s1', 'step-1', makeTracked('s1')),
      new StepLeaf('s2', 'step-2', makeTracked('s2', true)),  // fails
      new StepLeaf('s3', 'step-3', makeTracked('s3')),         // must not run
    ]);

    const ctx = makeCtx();
    await runSafe(job, ctx);

    expect(executed).toEqual(['s1', 's2']);
    expect(ctx.status).toBe('failed');
  });

  it('sets ctx.status to failed when a step throws', async () => {
    const job = new JobComposite('job-1', 'build', [
      new StepLeaf('s1', 'step-1', makeCommand(true)),
    ]);
    const ctx = makeCtx();
    await runSafe(job, ctx);
    expect(ctx.status).toBe('failed');
  });
});

// ---------------------------------------------------------------------------
// WorkflowComposite
// ---------------------------------------------------------------------------

describe('WorkflowComposite — sequential job execution', () => {
  it('runs all jobs when every job succeeds', async () => {
    const ran: string[] = [];
    const makeTrackedCmd = (id: string): ICommand => ({
      execute: async () => { ran.push(id); },
      toJSON: () => ({ type: 'run_script', script: '', workDir: '' }),
    });

    const workflow = new WorkflowComposite('wf-1', 'pipeline', [
      new JobComposite('j1', 'job-1', [new StepLeaf('s1', 'step', makeTrackedCmd('j1'))]),
      new JobComposite('j2', 'job-2', [new StepLeaf('s2', 'step', makeTrackedCmd('j2'))]),
    ]);

    await workflow.run(makeCtx());
    expect(ran).toEqual(['j1', 'j2']);
  });

  it('stops at the first failing job — subsequent jobs do not run', async () => {
    const ran: string[] = [];
    const makeTrackedCmd = (id: string, fail = false): ICommand => ({
      execute: async () => {
        ran.push(id);
        if (fail) throw new Error('job failed');
      },
      toJSON: () => ({ type: 'run_script', script: '', workDir: '' }),
    });

    const workflow = new WorkflowComposite('wf-1', 'pipeline', [
      new JobComposite('j1', 'job-1', [new StepLeaf('s1', 'step', makeTrackedCmd('j1', true))]),
      new JobComposite('j2', 'job-2', [new StepLeaf('s2', 'step', makeTrackedCmd('j2'))]),
    ]);

    const ctx = makeCtx();
    await runSafe(workflow, ctx);

    expect(ran).toEqual(['j1']);
    expect(ctx.status).toBe('failed');
  });

  it('emits node:status events for each node during a successful run', async () => {
    const events: Array<{ type: string; status: string }> = [];
    eventBus.on('node:status', (e) => events.push({ type: e.type, status: e.status }));

    const workflow = new WorkflowComposite('wf-1', 'pipeline', [
      new JobComposite('j1', 'job-1', [
        new StepLeaf('s1', 'step-1', makeCommand()),
      ]),
    ]);

    await workflow.run(makeCtx());

    // workflow running → job running → step running → step success → job success → workflow success
    expect(events).toEqual([
      { type: 'workflow', status: 'running' },
      { type: 'job',      status: 'running' },
      { type: 'step',     status: 'running' },
      { type: 'step',     status: 'success' },
      { type: 'job',      status: 'success' },
      { type: 'workflow', status: 'success' },
    ]);
  });

  it('emits failed node:status events in correct order when a step throws', async () => {
    const events: Array<{ type: string; status: string }> = [];
    eventBus.on('node:status', (e) => events.push({ type: e.type, status: e.status }));

    const workflow = new WorkflowComposite('wf-1', 'pipeline', [
      new JobComposite('j1', 'job-1', [
        new StepLeaf('s1', 'step-1', makeCommand(true)),
      ]),
    ]);

    await runSafe(workflow, makeCtx());

    expect(events).toEqual([
      { type: 'workflow', status: 'running' },
      { type: 'job',      status: 'running' },
      { type: 'step',     status: 'running' },
      { type: 'step',     status: 'failed' },
      { type: 'job',      status: 'failed' },
      { type: 'workflow', status: 'failed' },
    ]);
  });
});
