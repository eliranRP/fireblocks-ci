// ---------------------------------------------------------------------------
// Domain types — mirrors backend API response shapes
// ---------------------------------------------------------------------------

export type RunStatus = 'pending' | 'running' | 'success' | 'failed';

export interface StepRow {
  id: string;
  job_id: string;
  name: string;
  position: number;
  command_type: string;
  command_json: string;
  status: RunStatus;
  log: string | null;
  duration_ms: number | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface JobRow {
  id: string;
  workflow_id: string;
  name: string;
  position: number;
  status: RunStatus;
  started_at: string | null;
  finished_at: string | null;
  steps: StepRow[];
}

export interface WorkflowDetail {
  id: string;
  name: string;
  event: string;
  project_id: string;
  status: RunStatus;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  jobs: JobRow[];
}

// ---------------------------------------------------------------------------
// API input types
// ---------------------------------------------------------------------------

export interface CreateStepInput {
  name: string;
  type: 'shell';
  command: string;
}

export interface CreateJobInput {
  name: string;
  position?: number;
  steps: CreateStepInput[];
}

export interface CreateWorkflowInput {
  name: string;
  event: string;
  projectId: string;
  jobs: CreateJobInput[];
}

// ---------------------------------------------------------------------------
// SSE event types
// ---------------------------------------------------------------------------

export interface NodeStatusSseEvent {
  id: string;
  type: 'workflow' | 'stage' | 'job' | 'step';
  status: RunStatus;
}

export interface RunCompleteSseEvent {
  status: 'success' | 'failed';
  error?: string;
}
