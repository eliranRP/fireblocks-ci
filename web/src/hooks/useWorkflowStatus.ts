import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api-client';
import type { WorkflowDetail } from '../lib/types';

interface UseWorkflowStatusResult {
  workflow: WorkflowDetail | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useWorkflowStatus(workflowId: string): UseWorkflowStatusResult {
  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.workflows.getStatus(workflowId);
      setWorkflow(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  return { workflow, loading, error, refresh: fetchStatus };
}
