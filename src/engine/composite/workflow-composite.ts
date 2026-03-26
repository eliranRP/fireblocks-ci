import { WorkflowNode } from './workflow-node.js';
import type { StageComposite } from './stage-composite.js';
import type { RunContext } from '../context.js';

export class WorkflowComposite extends WorkflowNode {
  private readonly stages: StageComposite[];

  constructor(id: string, name: string, stages: StageComposite[]) {
    super(id, name, 'workflow');
    this.stages = stages;
  }

  async doWork(ctx: RunContext): Promise<void> {
    for (const stage of this.stages) {
      await stage.run(ctx);
      if (ctx.status === 'failed') return;
    }
  }
}
