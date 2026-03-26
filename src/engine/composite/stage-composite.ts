import { WorkflowNode } from './workflow-node.js';
import type { JobComposite } from './job-composite.js';
import type { RunContext } from '../context.js';

/**
 * StageComposite — Composite pattern node that groups jobs sharing the same
 * position number and runs them concurrently.
 *
 * Design decisions:
 *  - Promise.allSettled lets every parallel job finish before the stage
 *    reports its own outcome (no early-cancellation of sibling jobs).
 *  - If any job rejected, the stage re-throws so WorkflowComposite stops
 *    subsequent stages — pipeline halts on stage failure, not job failure.
 *  - Single-job stages are valid and behave identically to multi-job stages,
 *    which keeps WorkflowComposite's loop uniform.
 */
export class StageComposite extends WorkflowNode {
  private readonly jobs: JobComposite[];

  constructor(id: string, name: string, jobs: JobComposite[]) {
    super(id, name, 'stage');
    this.jobs = jobs;
  }

  async doWork(ctx: RunContext): Promise<void> {
    const results = await Promise.allSettled(
      this.jobs.map((job) => job.run(ctx)),
    );

    const firstRejection = results.find(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    if (firstRejection) {
      throw firstRejection.reason instanceof Error
        ? firstRejection.reason
        : new Error(String(firstRejection.reason));
    }
  }
}
