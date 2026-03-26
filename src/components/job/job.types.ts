export type JobStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface JobRow {
  id: string;
  workflow_id: string;
  name: string;
  position: number;
  status: JobStatus;
  started_at: string | null;
  finished_at: string | null;
}
