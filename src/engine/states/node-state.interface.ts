import type { RunContext } from '../context.js';
import type { WorkflowNode } from '../composite/workflow-node.js';

export interface INodeState {
  execute(node: WorkflowNode, ctx: RunContext): Promise<void>;
}
