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
  };
}

beforeEach(() => {
  eventBus.removeAllListeners();
});

describe('RunScriptCommand', () => {
  it('executes a successful shell command and emits step:result success', async () => {
    const results: Array<{ status: string; log: string }> = [];
    eventBus.on('step:result', (e) => results.push({ status: e.status, log: e.log }));

    const cmd = new RunScriptCommand({ stepId: 'step-1', script: 'echo hello', workDir: '/tmp' });
    await cmd.execute(makeCtx());

    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe('success');
    expect(results[0]?.log).toContain('hello');
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
