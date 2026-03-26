import { v4 as uuidv4 } from 'uuid';

export type RunStatus = 'pending' | 'running' | 'success' | 'failed';

export interface RunContext {
  readonly runId: string;
  readonly workflowId: string;
  readonly workDir: string;
  readonly env: Record<string, string>;
  // Mutable by design: nodes write their status here so parallel siblings can detect
  // a failure and abort their own step loops without explicit cancellation signals.
  status: RunStatus;
}

export function createRunContext(workflowId: string, workDir: string): RunContext {
  return {
    runId: uuidv4(),
    workflowId,
    workDir,
    env: {},
    status: 'pending',
  };
}
