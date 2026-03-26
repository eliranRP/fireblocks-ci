import { RunScriptCommand } from '../../src/engine/commands/run-script.command.js';
import { eventBus } from '../../src/libraries/events/event-bus.js';
import type { RunContext } from '../../src/engine/context.js';

function makeCtx(): RunContext {
  return {
    runId: 'run-1',
    workflowId: 'wf-1',
    workDir: '/tmp',
    env: {},
    status: 'pending',
    logs: [],
  };
}

beforeEach(() => {
  eventBus.removeAllListeners();
});

describe('RunScriptCommand', () => {
  it('executes a successful shell command and emits step:result success', async () => {
    const events: string[] = [];
    eventBus.on('step:result', (e) => events.push(e.status));

    const cmd = new RunScriptCommand({ stepId: 'step-1', script: 'echo hello', workDir: '/tmp' });
    const ctx = makeCtx();
    await cmd.execute(ctx);

    expect(ctx.logs.length).toBe(1);
    expect(ctx.logs[0]).toContain('hello');
    expect(events).toEqual(['success']);
  });

  it('emits step:result failed and re-throws on command failure', async () => {
    const events: string[] = [];
    eventBus.on('step:result', (e) => events.push(e.status));

    const cmd = new RunScriptCommand({ stepId: 'step-2', script: 'exit 1', workDir: '/tmp' });
    await expect(cmd.execute(makeCtx())).rejects.toThrow();
    expect(events).toEqual(['failed']);
  });

  it('toJSON returns serialisable command data', () => {
    const cmd = new RunScriptCommand({ stepId: 'step-1', script: 'npm test', workDir: '/app' });
    expect(cmd.toJSON()).toEqual({ type: 'run_script', script: 'npm test', workDir: '/app' });
  });
});
