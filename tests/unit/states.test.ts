import { PendingState } from '../../src/engine/states/pending.state.js';
import { RunningState } from '../../src/engine/states/running.state.js';
import { SuccessState } from '../../src/engine/states/success.state.js';
import { FailedState } from '../../src/engine/states/failed.state.js';
import { WorkflowNode } from '../../src/engine/composite/workflow-node.js';
import type { RunContext } from '../../src/engine/context.js';
import { eventBus } from '../../src/libraries/events/event-bus.js';

// Concrete stub to test abstract WorkflowNode
class TestNode extends WorkflowNode {
  public workCalled = false;
  public shouldThrow = false;

  constructor(id = 'test-id', name = 'test') {
    super(id, name, 'step');
  }

  async doWork(_ctx: RunContext): Promise<void> {
    this.workCalled = true;
    if (this.shouldThrow) throw new Error('Step failed');
  }
}

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
  // Silence event-bus during unit tests
  eventBus.removeAllListeners();
});

describe('PendingState', () => {
  it('transitions node to RunningState before executing', async () => {
    const node = new TestNode();
    const ctx = makeCtx();
    await new PendingState().execute(node, ctx);
    expect(node.workCalled).toBe(true);
  });
});

describe('RunningState', () => {
  it('transitions to SuccessState on success', async () => {
    const node = new TestNode();
    node.setState(new RunningState());
    const ctx = makeCtx();
    await new RunningState().execute(node, ctx);
    expect(node.workCalled).toBe(true);
    expect(ctx.status).toBe('pending'); // status only changes on failure
  });

  it('transitions to FailedState and re-throws on error', async () => {
    const node = new TestNode();
    node.shouldThrow = true;
    node.setState(new RunningState());
    const ctx = makeCtx();
    await expect(new RunningState().execute(node, ctx)).rejects.toThrow('Step failed');
    expect(ctx.status).toBe('failed');
  });

  it('emits node:status running and success events on success', async () => {
    const events: string[] = [];
    eventBus.on('node:status', (e) => events.push(e.status));
    const node = new TestNode();
    node.setState(new RunningState());
    await new RunningState().execute(node, makeCtx());
    expect(events).toEqual(['running', 'success']);
  });

  it('emits node:status running and failed events on failure', async () => {
    const events: string[] = [];
    eventBus.on('node:status', (e) => events.push(e.status));
    const node = new TestNode();
    node.shouldThrow = true;
    node.setState(new RunningState());
    await expect(new RunningState().execute(node, makeCtx())).rejects.toThrow();
    expect(events).toEqual(['running', 'failed']);
  });
});

describe('SuccessState', () => {
  it('is a no-op terminal state', async () => {
    const node = new TestNode();
    await new SuccessState().execute(node, makeCtx());
    expect(node.workCalled).toBe(false);
  });
});

describe('FailedState', () => {
  it('throws CIError preventing re-run', async () => {
    const node = new TestNode();
    await expect(new FailedState().execute(node, makeCtx())).rejects.toThrow(
      'Node is in failed state and cannot be re-run',
    );
  });
});
