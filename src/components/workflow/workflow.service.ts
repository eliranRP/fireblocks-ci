import * as workflowDal from './workflow.dal.js';
import * as jobDal from '../job/job.dal.js';
import * as stepDal from '../step/step.dal.js';
import { WorkflowComposite } from '../../engine/composite/workflow-composite.js';
import { JobComposite } from '../../engine/composite/job-composite.js';
import { StepLeaf } from '../../engine/composite/step-leaf.js';
import { RunScriptCommand } from '../../engine/commands/run-script.command.js';
import { createRunContext } from '../../engine/context.js';
import { runWorkflow } from '../../engine/runner.js';
import { config } from '../../config/index.js';
import type { CreateWorkflowInput, WorkflowRow } from './workflow.types.js';
import type { JobRow } from '../job/job.types.js';
import type { StepRow } from '../step/step.types.js';

export function createWorkflow(input: CreateWorkflowInput): WorkflowRow {
  const workflow = workflowDal.insertWorkflow(input.name, input.event, input.projectId);

  input.jobs.forEach((jobInput, jobIndex) => {
    const job = jobDal.insertJob(workflow.id, jobInput.name, jobIndex);

    jobInput.steps.forEach((stepInput, stepIndex) => {
      const command = new RunScriptCommand({
        stepId: 'placeholder', // replaced after DB insert
        script: stepInput.command,
        workDir: config.workDir,
      });
      stepDal.insertStep(
        job.id,
        stepInput.name,
        stepIndex,
        'run_script',
        JSON.stringify({ type: 'run_script', script: stepInput.command, workDir: config.workDir }),
      );
    });
  });

  return workflow;
}

export function triggerRun(workflowId: string): string {
  const jobs = jobDal.findByWorkflowId(workflowId);

  const jobComposites = jobs.map((jobRow: JobRow) => {
    const stepRows = stepDal.findByJobId(jobRow.id);
    const stepLeaves = stepRows.map((stepRow: StepRow) => {
      const command = new RunScriptCommand({
        stepId: stepRow.id,
        script: JSON.parse(stepRow.command_json).script as string,
        workDir: JSON.parse(stepRow.command_json).workDir as string,
      });
      return new StepLeaf(stepRow.id, stepRow.name, command);
    });
    return new JobComposite(jobRow.id, jobRow.name, stepLeaves);
  });

  const tree = new WorkflowComposite(workflowId, workflowId, jobComposites);
  const ctx = createRunContext(workflowId, config.workDir);

  // Fire-and-forget — caller gets runId immediately
  void runWorkflow(tree, ctx);

  return ctx.runId;
}

export function getStatus(workflowId: string) {
  const workflow = workflowDal.findById(workflowId);
  const jobs = jobDal.findByWorkflowId(workflowId);

  const jobsWithSteps = jobs.map((job: JobRow) => ({
    ...job,
    steps: stepDal.findByJobId(job.id),
  }));

  return { ...workflow, jobs: jobsWithSteps };
}
