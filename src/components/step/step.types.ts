export type StepStatus = 'pending' | 'running' | 'success' | 'failed';

export type CommandType = 'run_script' | 'docker_run';

export interface StepRow {
  id: string;
  job_id: string;
  name: string;
  position: number;
  command_type: CommandType;
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
