import * as jobDal from './job.dal.js';
import * as stepDal from '../step/step.dal.js';
import type { JobRow } from './job.types.js';
import type { StepRow } from '../step/step.types.js';

export function getJobsForWorkflow(workflowId: string): (JobRow & { steps: StepRow[] })[] {
  const jobs = jobDal.findByWorkflowId(workflowId);
  return jobs.map((job) => ({ ...job, steps: stepDal.findByJobId(job.id) }));
}

export function getJob(jobId: string): JobRow {
  return jobDal.findById(jobId);
}
