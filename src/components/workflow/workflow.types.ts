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

export type StepCommandType = 'shell' | 'run_script' | 'docker_run';

export interface CreateStepInput {
  name: string;
  /** 'shell' and 'run_script' are aliases for shell execution; 'docker_run' runs inside a container. */
  type: StepCommandType;
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
