import type {
  CreateWorkflowInput,
  WorkflowDetail,
} from './types';

// ---------------------------------------------------------------------------
// Facade over fetch — all HTTP calls flow through here.
// Add an Authorization header here once auth is implemented.
// ---------------------------------------------------------------------------

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Workflow endpoints
// ---------------------------------------------------------------------------

export const apiClient = {
  workflows: {
    list: () =>
      request<WorkflowDetail[]>('/workflows'),

    create: (input: CreateWorkflowInput) =>
      request<WorkflowDetail>('/workflows', {
        method: 'POST',
        body: JSON.stringify(input),
      }),

    triggerRun: (workflowId: string) =>
      request<{ runId: string }>(`/workflows/${workflowId}/run`, { method: 'POST' }),

    getStatus: (workflowId: string) =>
      request<WorkflowDetail>(`/workflows/${workflowId}/status`),
  },

  steps: {
    getLogs: (stepId: string) =>
      request<{ log: string | null }>(`/steps/${stepId}/logs`),
  },
};
