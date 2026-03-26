import { WorkflowNode } from './workflow-node.js';
import type { StepLeaf } from './step-leaf.js';
import type { RunContext } from '../context.js';

export class JobComposite extends WorkflowNode {
  private readonly steps: StepLeaf[];

  constructor(id: string, name: string, steps: StepLeaf[]) {
    super(id, name, 'job');
    this.steps = steps;
  }

  async doWork(ctx: RunContext): Promise<void> {
    for (const step of this.steps) {
      await step.run(ctx);
      if (ctx.status === 'failed') return;
    }
  }
}
