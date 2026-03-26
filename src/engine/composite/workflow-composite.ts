import { WorkflowNode } from './workflow-node.js';
import type { JobComposite } from './job-composite.js';
import type { RunContext } from '../context.js';

export class WorkflowComposite extends WorkflowNode {
  private readonly jobs: JobComposite[];

  constructor(id: string, name: string, jobs: JobComposite[]) {
    super(id, name, 'workflow');
    this.jobs = jobs;
  }

  async doWork(ctx: RunContext): Promise<void> {
    for (const job of this.jobs) {
      await job.run(ctx);
      if (ctx.status === 'failed') return;
    }
  }
}
