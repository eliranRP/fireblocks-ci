import type { INodeState } from './node-state.interface.js';
import type { WorkflowNode } from '../composite/workflow-node.js';
import type { RunContext } from '../context.js';
import { RunningState } from './running.state.js';

export class PendingState implements INodeState {
  async execute(node: WorkflowNode, ctx: RunContext): Promise<void> {
    node.setState(new RunningState());
    await node.run(ctx);
  }
}
