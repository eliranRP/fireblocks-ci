import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api-client';
import type { WorkflowDetail } from '../lib/types';

interface UseWorkflowListResult {
  workflows: WorkflowDetail[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useWorkflowList(): UseWorkflowListResult {
  const [workflows, setWorkflows] = useState<WorkflowDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.workflows.list();
      setWorkflows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return { workflows, loading, error, refresh: fetchAll };
}
