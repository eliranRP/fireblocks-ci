import type { INodeState } from './node-state.interface.js';
import type { WorkflowNode } from '../composite/workflow-node.js';
import type { RunContext } from '../context.js';
import { CIError } from '../../libraries/error-handler/errors.js';

export class FailedState implements INodeState {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async execute(_node: WorkflowNode, _ctx: RunContext): Promise<void> {
    throw new CIError('Node is in failed state and cannot be re-run');
  }
}
