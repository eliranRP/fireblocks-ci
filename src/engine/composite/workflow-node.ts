import type { INodeState } from '../states/node-state.interface.js';
import type { RunContext } from '../context.js';
import { PendingState } from '../states/pending.state.js';

export type NodeType = 'workflow' | 'stage' | 'job' | 'step';

export abstract class WorkflowNode {
  protected state: INodeState;

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly type: NodeType,
  ) {
    this.state = new PendingState();
  }

  setState(state: INodeState): void {
    this.state = state;
  }

  async run(ctx: RunContext): Promise<void> {
    return this.state.execute(this, ctx);
  }

  abstract doWork(ctx: RunContext): Promise<void>;
}
