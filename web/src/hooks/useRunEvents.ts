import { useEffect } from 'react';
import type { NodeStatusSseEvent, RunCompleteSseEvent } from '../lib/types';

interface UseRunEventsOptions {
  /** The workflow/run ID to subscribe to. Pass null to skip. */
  runId: string | null;
  onNodeStatus?: (event: NodeStatusSseEvent) => void;
  onRunComplete?: (event: RunCompleteSseEvent) => void;
}

// Observer pattern: backend SSE stream → React state via callbacks.
// The caller decides what state to update — this hook is pure subscription logic.
export function useRunEvents({
  runId,
  onNodeStatus,
  onRunComplete,
}: UseRunEventsOptions): void {
  useEffect(() => {
    if (!runId) return;

    const source = new EventSource(`/api/workflows/${runId}/events`);

    source.addEventListener('node:status', (e) => {
      if (!onNodeStatus) return;
      try {
        const event = JSON.parse(e.data) as NodeStatusSseEvent;
        onNodeStatus(event);
      } catch {
        // malformed SSE payload — ignore
      }
    });

    source.addEventListener('run:complete', (e) => {
      if (!onRunComplete) return;
      try {
        const event = JSON.parse(e.data) as RunCompleteSseEvent;
        onRunComplete(event);
      } catch {
        // malformed SSE payload — ignore
      }
      source.close();
    });

    source.onerror = () => source.close();

    return () => source.close();
  }, [runId, onNodeStatus, onRunComplete]);
}
