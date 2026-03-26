import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { getDb } from '../../libraries/db/db.js';
import { workflows, jobs, steps } from '../../libraries/db/schema.js';
import * as workflowDal from './workflow.dal.js';
import * as jobDal from '../job/job.dal.js';
import * as stepDal from '../step/step.dal.js';
import { WorkflowComposite } from '../../engine/composite/workflow-composite.js';
import { StageComposite } from '../../engine/composite/stage-composite.js';
import { JobComposite } from '../../engine/composite/job-composite.js';
import { StepLeaf } from '../../engine/composite/step-leaf.js';
import { fromRow as commandFromRow } from '../../engine/commands/command-factory.js';
import { createRunContext } from '../../engine/context.js';
import { runWorkflow } from '../../engine/runner.js';
import { config } from '../../config/index.js';
import type { CreateWorkflowInput, WorkflowRow, StepCommandType } from './workflow.types.js';
import type { JobRow } from '../job/job.types.js';
import type { StepRow } from '../step/step.types.js';

export interface WorkflowDetail {
  id: string;
  name: string;
  event: string;
  project_id: string;
  status: WorkflowRow['status'];
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  jobs: Array<JobRow & { steps: StepRow[] }>;
}

/**
 * Creates a workflow definition — workflow, jobs, and steps — atomically.
 * If any insert fails the entire operation rolls back, leaving no orphaned rows.
 */
export function createWorkflow(input: CreateWorkflowInput): WorkflowRow {
  const db = getDb();
  const workflowId = uuidv4();

  return db.transaction((tx) => {
    tx.insert(workflows).values({
      id:         workflowId,
      name:       input.name,
      event:      input.event,
      project_id: input.projectId,
    }).run();

    input.jobs.forEach((jobInput, jobIndex) => {
      const jobId = uuidv4();
      tx.insert(jobs).values({
        id:          jobId,
        workflow_id: workflowId,
        name:        jobInput.name,
        position:    jobInput.position ?? jobIndex,
      }).run();

      jobInput.steps.forEach((stepInput, stepIndex) => {
        // 'shell' is an alias for 'run_script' at the API boundary
        const commandType: StepCommandType = stepInput.type === 'shell' ? 'run_script' : stepInput.type;
        tx.insert(steps).values({
          id:           uuidv4(),
          job_id:       jobId,
          name:         stepInput.name,
          position:     stepIndex,
          command_type: commandType,
          command_json: JSON.stringify({ type: commandType, script: stepInput.command, workDir: config.workDir }),
        }).run();
      });
    });

    const row = tx.select().from(workflows).where(eq(workflows.id, workflowId)).get();
    return row as WorkflowRow;
  });
}

/**
 * Groups DB rows into the Composite execution tree — no side effects.
 * Invariant: jobRows is non-empty — enforced by Zod (jobs.min(1)) at the API boundary.
 */
function buildExecutionTree(workflow: WorkflowRow, jobRows: JobRow[]): WorkflowComposite {
  // Jobs with the same position run as a parallel stage; different positions run sequentially.
  const byPosition = new Map<number, JobRow[]>();
  for (const jobRow of jobRows) {
    const group = byPosition.get(jobRow.position) ?? [];
    group.push(jobRow);
    byPosition.set(jobRow.position, group);
  }

  const stages = [...byPosition.entries()]
    .sort(([a], [b]) => a - b)
    .map(([pos, group]) => {
      const jobComposites = group.map((jobRow: JobRow) => {
        const stepLeaves = stepDal.findByJobId(jobRow.id).map((stepRow: StepRow) =>
          new StepLeaf(stepRow.id, stepRow.name, commandFromRow(stepRow)),
        );
        return new JobComposite(jobRow.id, jobRow.name, stepLeaves);
      });

      // Single-job stage: reuse the job name for cleaner SSE output.
      const stageName = group.length === 1 ? group[0]!.name : `Stage ${pos}`;
      return new StageComposite(`stage-${pos}-${workflow.id}`, stageName, jobComposites);
    });

  return new WorkflowComposite(workflow.id, workflow.name, stages);
}

export function triggerRun(workflowId: string): string {
  const workflow = workflowDal.findById(workflowId);
  const jobRows = jobDal.findByWorkflowId(workflowId);

  const tree = buildExecutionTree(workflow, jobRows);
  const ctx = createRunContext(workflowId, config.workDir);

  // Fire-and-forget — caller gets runId immediately
  void runWorkflow(tree, ctx);

  return ctx.runId;
}

export function getStatus(workflowId: string): WorkflowDetail {
  const workflow = workflowDal.findById(workflowId);
  const jobRows = jobDal.findByWorkflowId(workflowId);

  return {
    ...workflow,
    jobs: jobRows.map((job: JobRow) => ({ ...job, steps: stepDal.findByJobId(job.id) })),
  };
}
