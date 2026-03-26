import type { INodeState } from './node-state.interface.js';
import type { WorkflowNode } from '../composite/workflow-node.js';
import type { RunContext } from '../context.js';
import { SuccessState } from './success.state.js';
import { FailedState } from './failed.state.js';
import { eventBus } from '../../libraries/events/event-bus.js';

export class RunningState implements INodeState {
  async execute(node: WorkflowNode, ctx: RunContext): Promise<void> {
    eventBus.emit('node:status', { id: node.id, type: node.type, status: 'running', runId: ctx.runId });

    try {
      await node.doWork(ctx);
      node.setState(new SuccessState());
      eventBus.emit('node:status', { id: node.id, type: node.type, status: 'success', runId: ctx.runId });
    } catch (err) {
      node.setState(new FailedState());
      ctx.status = 'failed';
      const message = err instanceof Error ? err.message : String(err);
      eventBus.emit('node:status', { id: node.id, type: node.type, status: 'failed', runId: ctx.runId, error: message });
      throw err;
    }
  }
}
