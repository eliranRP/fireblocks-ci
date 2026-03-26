import { runWorkflow } from '../../src/engine/runner.js';
import { WorkflowComposite } from '../../src/engine/composite/workflow-composite.js';
import { JobComposite } from '../../src/engine/composite/job-composite.js';
import { StepLeaf } from '../../src/engine/composite/step-leaf.js';
import { createRunContext } from '../../src/engine/context.js';
import type { ICommand } from '../../src/engine/commands/command.interface.js';
import type { RunCompleteEvent, RunStartEvent } from '../../src/libraries/events/event-bus.types.js';
import { eventBus } from '../../src/libraries/events/event-bus.js';

function makeCommand(shouldFail = false): ICommand {
  return {
    execute: async () => {
      if (shouldFail) throw new Error('step failed');
    },
    toJSON: () => ({ type: 'run_script', script: '', workDir: '' }),
  };
}

function singleStepWorkflow(workflowId: string, fail = false): WorkflowComposite {
  return new WorkflowComposite(workflowId, 'pipeline', [
    new JobComposite('j1', 'job-1', [
      new StepLeaf('s1', 'step-1', makeCommand(fail)),
    ]),
  ]);
}

function captureRunEvents(runId: string): Promise<{ start: RunStartEvent; complete: RunCompleteEvent }> {
  return new Promise((resolve) => {
    let start: RunStartEvent | undefined;
    eventBus.on('run:start', (e: RunStartEvent) => {
      if (e.runId === runId) start = e;
    });
    eventBus.on('run:complete', (e: RunCompleteEvent) => {
      if (e.runId === runId && start) resolve({ start, complete: e });
    });
  });
}

beforeEach(() => {
  eventBus.removeAllListeners();
});

describe('runWorkflow — event emission', () => {
  it('emits run:start before execution begins', async () => {
    const ctx = createRunContext('wf-1', '/tmp');
    const tree = singleStepWorkflow('wf-1');
    const events = captureRunEvents(ctx.runId);

    await runWorkflow(tree, ctx);

    const { start } = await events;
    expect(start.runId).toBe(ctx.runId);
    expect(start.workflowId).toBe('wf-1');
  });

  it('emits run:complete with status success when all steps pass', async () => {
    const ctx = createRunContext('wf-1', '/tmp');
    const tree = singleStepWorkflow('wf-1');
    const events = captureRunEvents(ctx.runId);

    await runWorkflow(tree, ctx);

    const { complete } = await events;
    expect(complete.status).toBe('success');
    expect(complete.error).toBeUndefined();
  });

  it('emits run:complete with status failed when a step fails', async () => {
    const ctx = createRunContext('wf-1', '/tmp');
    const tree = singleStepWorkflow('wf-1', true);
    const events = captureRunEvents(ctx.runId);

    await runWorkflow(tree, ctx);

    const { complete } = await events;
    expect(complete.status).toBe('failed');
  });

  it('always emits run:complete even when the handler chain throws unexpectedly', async () => {
    // Pass a tree with an invalid workflowId to trigger ValidateHandler error
    const ctx = createRunContext('wf-1', '/tmp');
    ctx.workflowId = ''; // ValidateHandler requires a non-empty workflowId
    const tree = singleStepWorkflow('wf-1');

    let completed = false;
    eventBus.on('run:complete', (e: RunCompleteEvent) => {
      if (e.runId === ctx.runId) completed = true;
    });

    await runWorkflow(tree, ctx);
    expect(completed).toBe(true);
  });
});

describe('runWorkflow — run:start and run:complete are always paired', () => {
  it('each run emits exactly one run:start and one run:complete', async () => {
    const ctx = createRunContext('wf-1', '/tmp');
    const tree = singleStepWorkflow('wf-1');

    const starts: string[] = [];
    const completes: string[] = [];
    eventBus.on('run:start', (e: RunStartEvent) => starts.push(e.runId));
    eventBus.on('run:complete', (e: RunCompleteEvent) => completes.push(e.runId));

    await runWorkflow(tree, ctx);

    expect(starts).toEqual([ctx.runId]);
    expect(completes).toEqual([ctx.runId]);
  });
});
