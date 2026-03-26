import { v4 as uuidv4 } from 'uuid';

export type RunStatus = 'pending' | 'running' | 'success' | 'failed';

export interface RunContext {
  readonly runId: string;
  readonly workflowId: string;
  readonly workDir: string;
  readonly env: Record<string, string>;
  status: RunStatus;
  logs: string[];
}

export function createRunContext(workflowId: string, workDir: string): RunContext {
  return {
    runId: uuidv4(),
    workflowId,
    workDir,
    env: {},
    status: 'pending',
    logs: [],
  };
}
