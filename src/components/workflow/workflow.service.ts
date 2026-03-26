import * as workflowDal from './workflow.dal.js';
import * as jobDal from '../job/job.dal.js';
import * as stepDal from '../step/step.dal.js';
import { WorkflowComposite } from '../../engine/composite/workflow-composite.js';
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

export function createWorkflow(input: CreateWorkflowInput): WorkflowRow {
  const workflow = workflowDal.insertWorkflow(input.name, input.event, input.projectId);

  input.jobs.forEach((jobInput, jobIndex) => {
    const job = jobDal.insertJob(workflow.id, jobInput.name, jobIndex);

    jobInput.steps.forEach((stepInput, stepIndex) => {
      // 'shell' is an alias for 'run_script' at the API boundary
      const commandType: StepCommandType = stepInput.type === 'shell' ? 'run_script' : stepInput.type;
      stepDal.insertStep(
        job.id,
        stepInput.name,
        stepIndex,
        commandType,
        JSON.stringify({ type: commandType, script: stepInput.command, workDir: config.workDir }),
      );
    });
  });

  return workflow;
}

export function triggerRun(workflowId: string): string {
  const workflow = workflowDal.findById(workflowId);
  const jobs = jobDal.findByWorkflowId(workflowId);

  const jobComposites = jobs.map((jobRow: JobRow) => {
    const stepRows = stepDal.findByJobId(jobRow.id);
    const stepLeaves = stepRows.map((stepRow: StepRow) =>
      new StepLeaf(stepRow.id, stepRow.name, commandFromRow(stepRow)),
    );
    return new JobComposite(jobRow.id, jobRow.name, stepLeaves);
  });

  const tree = new WorkflowComposite(workflow.id, workflow.name, jobComposites);
  const ctx = createRunContext(workflowId, config.workDir);

  // Fire-and-forget — caller gets runId immediately
  void runWorkflow(tree, ctx);

  return ctx.runId;
}

export function getStatus(workflowId: string): WorkflowDetail {
  const workflow = workflowDal.findById(workflowId);
  const jobs = jobDal.findByWorkflowId(workflowId);

  return {
    ...workflow,
    jobs: jobs.map((job: JobRow) => ({ ...job, steps: stepDal.findByJobId(job.id) })),
  };
}
