import type { INodeState } from './node-state.interface.js';
import type { WorkflowNode } from '../composite/workflow-node.js';
import type { RunContext } from '../context.js';

export class SuccessState implements INodeState {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async execute(_node: WorkflowNode, _ctx: RunContext): Promise<void> {
    // Terminal state — no-op
  }
}
