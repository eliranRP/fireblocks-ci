export type StepStatus = 'pending' | 'running' | 'success' | 'failed';

export interface StepRow {
  id: string;
  job_id: string;
  name: string;
  position: number;
  command_type: string;
  command_json: string;
  status: StepStatus;
  log: string | null;
  duration_ms: number | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface StepResult {
  status: StepStatus;
  log: string;
  duration_ms: number;
}
