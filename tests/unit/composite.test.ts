import { WorkflowComposite } from '../../src/engine/composite/workflow-composite.js';
import { StageComposite } from '../../src/engine/composite/stage-composite.js';
import { JobComposite } from '../../src/engine/composite/job-composite.js';
import { StepLeaf } from '../../src/engine/composite/step-leaf.js';
import type { ICommand } from '../../src/engine/commands/command.interface.js';
import type { RunContext } from '../../src/engine/context.js';
import { eventBus } from '../../src/libraries/events/event-bus.js';

// ── helpers ────────────────────────────────────────────────────────────────

function makeCommand(shouldFail = false): ICommand {
  return {
    execute: async () => {
      if (shouldFail) throw new Error('command failed');
    },
    toJSON: () => ({ type: 'run_script', script: '', workDir: '' }),
  };
}

function makeTrackedCommand(id: string, log: string[], fail = false): ICommand {
  return {
    execute: async () => {
      log.push(id);
      if (fail) throw new Error(`${id} failed`);
    },
    toJSON: () => ({ type: 'run_script', script: '', workDir: '' }),
  };
}

function makeCtx(): RunContext {
  return { runId: 'r1', workflowId: 'wf-1', workDir: '/tmp', env: {}, status: 'pending' };
}

/** Wraps a single JobComposite in a same-position StageComposite — convenience for sequential tests. */
function singleStage(job: JobComposite): StageComposite {
  return new StageComposite(`stage-${job.id}`, job.name, [job]);
}

/** Run a node, swallowing the re-throw that RunningState emits on failure. */
async function runSafe(
  node: WorkflowComposite | JobComposite | StageComposite,
  ctx: RunContext,
): Promise<void> {
  try {
    await node.run(ctx);
  } catch {
    // expected — RunningState always re-throws on failure; ctx.status is already 'failed'
  }
}

beforeEach(() => {
  eventBus.removeAllListeners();
});

// ── JobComposite ────────────────────────────────────────────────────────────

describe('JobComposite — sequential step execution', () => {
  it('runs all steps when every step succeeds', async () => {
    const log: string[] = [];
    const job = new JobComposite('job-1', 'build', [
      new StepLeaf('s1', 'step-1', makeTrackedCommand('s1', log)),
      new StepLeaf('s2', 'step-2', makeTrackedCommand('s2', log)),
      new StepLeaf('s3', 'step-3', makeTrackedCommand('s3', log)),
    ]);

    await job.run(makeCtx());
    expect(log).toEqual(['s1', 's2', 's3']);
  });

  it('stops after a failing step — subsequent steps do not execute', async () => {
    const log: string[] = [];
    const job = new JobComposite('job-1', 'build', [
      new StepLeaf('s1', 'step-1', makeTrackedCommand('s1', log)),
      new StepLeaf('s2', 'step-2', makeTrackedCommand('s2', log, true)),  // fails
      new StepLeaf('s3', 'step-3', makeTrackedCommand('s3', log)),         // must not run
    ]);

    const ctx = makeCtx();
    await runSafe(job, ctx);

    expect(log).toEqual(['s1', 's2']);
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

// ── StageComposite ──────────────────────────────────────────────────────────

describe('StageComposite — parallel job execution', () => {
  it('runs all parallel jobs when every job succeeds', async () => {
    const log: string[] = [];
    const stage = new StageComposite('stage-0', 'parallel', [
      new JobComposite('j1', 'job-a', [new StepLeaf('s1', 'step', makeTrackedCommand('j1', log))]),
      new JobComposite('j2', 'job-b', [new StepLeaf('s2', 'step', makeTrackedCommand('j2', log))]),
    ]);

    await stage.run(makeCtx());
    expect(log.sort()).toEqual(['j1', 'j2']);
  });

  it('marks stage as failed when one parallel job fails', async () => {
    const log: string[] = [];
    const stage = new StageComposite('stage-0', 'parallel', [
      new JobComposite('j1', 'job-a', [new StepLeaf('s1', 'step', makeTrackedCommand('j1', log, true))]),
      new JobComposite('j2', 'job-b', [new StepLeaf('s2', 'step', makeTrackedCommand('j2', log))]),
    ]);

    const ctx = makeCtx();
    await runSafe(stage, ctx);
    expect(ctx.status).toBe('failed');
  });

  it('allows all parallel jobs to run even when one fails (Promise.allSettled)', async () => {
    const started: string[] = [];
    // job-a fails immediately, job-b has a slight async delay
    const slowSucceed: ICommand = {
      execute: async () => {
        started.push('j2');
        await Promise.resolve(); // yield to event loop
      },
      toJSON: () => ({ type: 'run_script', script: '', workDir: '' }),
    };
    const failFast: ICommand = {
      execute: async () => {
        started.push('j1');
        throw new Error('fast fail');
      },
      toJSON: () => ({ type: 'run_script', script: '', workDir: '' }),
    };

    const stage = new StageComposite('stage-0', 'parallel', [
      new JobComposite('j1', 'job-a', [new StepLeaf('s1', 'step', failFast)]),
      new JobComposite('j2', 'job-b', [new StepLeaf('s2', 'step', slowSucceed)]),
    ]);

    const ctx = makeCtx();
    await runSafe(stage, ctx);

    // Both jobs were started — allSettled does not cancel siblings
    expect(started).toContain('j1');
    expect(started).toContain('j2');
  });

  it('emits node:status events for all parallel jobs', async () => {
    const events: Array<{ type: string; status: string; id: string }> = [];
    eventBus.on('node:status', (e) => events.push({ type: e.type, status: e.status, id: e.id }));

    const stage = new StageComposite('stage-0', 'parallel', [
      new JobComposite('j1', 'job-a', [new StepLeaf('s1', 'step', makeCommand())]),
      new JobComposite('j2', 'job-b', [new StepLeaf('s2', 'step', makeCommand())]),
    ]);

    await stage.run(makeCtx());

    const stageEvents = events.filter((e) => e.type === 'stage');
    const jobEvents   = events.filter((e) => e.type === 'job');

    expect(stageEvents).toContainEqual({ type: 'stage', status: 'running', id: 'stage-0' });
    expect(stageEvents).toContainEqual({ type: 'stage', status: 'success', id: 'stage-0' });
    expect(jobEvents.filter((e) => e.status === 'success')).toHaveLength(2);
  });
});

// ── WorkflowComposite ───────────────────────────────────────────────────────

describe('WorkflowComposite — sequential stage execution', () => {
  it('runs all stages when every stage succeeds', async () => {
    const log: string[] = [];
    const workflow = new WorkflowComposite('wf-1', 'pipeline', [
      singleStage(new JobComposite('j1', 'job-1', [new StepLeaf('s1', 'step', makeTrackedCommand('j1', log))])),
      singleStage(new JobComposite('j2', 'job-2', [new StepLeaf('s2', 'step', makeTrackedCommand('j2', log))])),
    ]);

    await workflow.run(makeCtx());
    expect(log).toEqual(['j1', 'j2']);
  });

  it('stops at the first failing stage — subsequent stages do not run', async () => {
    const log: string[] = [];
    const workflow = new WorkflowComposite('wf-1', 'pipeline', [
      singleStage(new JobComposite('j1', 'job-1', [new StepLeaf('s1', 'step', makeTrackedCommand('j1', log, true))])),
      singleStage(new JobComposite('j2', 'job-2', [new StepLeaf('s2', 'step', makeTrackedCommand('j2', log))])),
    ]);

    const ctx = makeCtx();
    await runSafe(workflow, ctx);

    expect(log).toEqual(['j1']);
    expect(ctx.status).toBe('failed');
  });

  it('emits node:status events in correct order during a successful run', async () => {
    const events: Array<{ type: string; status: string }> = [];
    eventBus.on('node:status', (e) => events.push({ type: e.type, status: e.status }));

    const workflow = new WorkflowComposite('wf-1', 'pipeline', [
      singleStage(new JobComposite('j1', 'job-1', [new StepLeaf('s1', 'step-1', makeCommand())])),
    ]);

    await workflow.run(makeCtx());

    // workflow running → stage running → job running → step running → step success
    //   → job success → stage success → workflow success
    expect(events).toEqual([
      { type: 'workflow', status: 'running' },
      { type: 'stage',   status: 'running' },
      { type: 'job',     status: 'running' },
      { type: 'step',    status: 'running' },
      { type: 'step',    status: 'success' },
      { type: 'job',     status: 'success' },
      { type: 'stage',   status: 'success' },
      { type: 'workflow', status: 'success' },
    ]);
  });

  it('emits failed node:status events in correct order when a step throws', async () => {
    const events: Array<{ type: string; status: string }> = [];
    eventBus.on('node:status', (e) => events.push({ type: e.type, status: e.status }));

    const workflow = new WorkflowComposite('wf-1', 'pipeline', [
      singleStage(new JobComposite('j1', 'job-1', [new StepLeaf('s1', 'step-1', makeCommand(true))])),
    ]);

    await runSafe(workflow, makeCtx());

    expect(events).toEqual([
      { type: 'workflow', status: 'running' },
      { type: 'stage',   status: 'running' },
      { type: 'job',     status: 'running' },
      { type: 'step',    status: 'running' },
      { type: 'step',    status: 'failed' },
      { type: 'job',     status: 'failed' },
      { type: 'stage',   status: 'failed' },
      { type: 'workflow', status: 'failed' },
    ]);
  });

  it('skips second stage when first stage fails', async () => {
    const events: Array<{ type: string; status: string }> = [];
    eventBus.on('node:status', (e) => events.push({ type: e.type, status: e.status }));

    const workflow = new WorkflowComposite('wf-1', 'pipeline', [
      singleStage(new JobComposite('j1', 'job-1', [new StepLeaf('s1', 'step-1', makeCommand(true))])),
      singleStage(new JobComposite('j2', 'job-2', [new StepLeaf('s2', 'step-2', makeCommand())])),
    ]);

    await runSafe(workflow, makeCtx());

    // Only step-1 events should exist (running + failed) — step-2 was never started
    const stepEvents = events.filter((e) => e.type === 'step');
    expect(stepEvents).toHaveLength(2);
    expect(stepEvents).not.toContainEqual({ type: 'step', status: 'success' });

    // Only one job ran (job-1), so exactly 2 job events: running + failed
    const jobEvents = events.filter((e) => e.type === 'job');
    expect(jobEvents).toHaveLength(2);
    expect(jobEvents).toContainEqual({ type: 'job', status: 'running' });
    expect(jobEvents).toContainEqual({ type: 'job', status: 'failed' });
  });

  it('parallel stage: both jobs run concurrently, workflow succeeds', async () => {
    const log: string[] = [];
    const parallelStage = new StageComposite('stage-0', 'parallel-stage', [
      new JobComposite('j1', 'job-a', [new StepLeaf('s1', 'step', makeTrackedCommand('j1', log))]),
      new JobComposite('j2', 'job-b', [new StepLeaf('s2', 'step', makeTrackedCommand('j2', log))]),
    ]);

    const workflow = new WorkflowComposite('wf-1', 'pipeline', [parallelStage]);
    await workflow.run(makeCtx());

    expect(log.sort()).toEqual(['j1', 'j2']);
  });

  it('parallel stage failure stops subsequent sequential stage', async () => {
    const log: string[] = [];
    const parallelStage = new StageComposite('stage-0', 'parallel-stage', [
      new JobComposite('j1', 'job-a', [new StepLeaf('s1', 'step', makeTrackedCommand('j1', log, true))]),
      new JobComposite('j2', 'job-b', [new StepLeaf('s2', 'step', makeTrackedCommand('j2', log))]),
    ]);
    const nextStage = singleStage(
      new JobComposite('j3', 'job-c', [new StepLeaf('s3', 'step', makeTrackedCommand('j3', log))]),
    );

    const workflow = new WorkflowComposite('wf-1', 'pipeline', [parallelStage, nextStage]);
    const ctx = makeCtx();
    await runSafe(workflow, ctx);

    expect(log).not.toContain('j3');
    expect(ctx.status).toBe('failed');
  });
});
