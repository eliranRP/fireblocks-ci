export type WorkflowStatus = 'pending' | 'running' | 'success' | 'failed';

export interface WorkflowRow {
  id: string;
  name: string;
  event: string;
  project_id: string;
  status: WorkflowStatus;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface CreateStepInput {
  name: string;
  type: string;
  command: string;
}

export interface CreateJobInput {
  name: string;
  steps: CreateStepInput[];
}

export interface CreateWorkflowInput {
  name: string;
  event: string;
  projectId: string;
  jobs: CreateJobInput[];
}
