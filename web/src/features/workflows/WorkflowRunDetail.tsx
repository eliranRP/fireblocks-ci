import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Play, RefreshCw } from 'lucide-react';
import { useWorkflowStatus } from '../../hooks/useWorkflowStatus';
import { useRunEvents } from '../../hooks/useRunEvents';
import { apiClient } from '../../lib/api-client';
import {
  Button,
  Card,
  CardHeader,
  StatusBadge,
  LogViewer,
  FullPageSpinner,
  ErrorMessage,
} from '../../core';
import type { JobRow, NodeStatusSseEvent, RunCompleteSseEvent, StepRow } from '../../lib/types';

interface WorkflowRunDetailProps {
  workflowId: string;
}

export function WorkflowRunDetail({ workflowId }: WorkflowRunDetailProps) {
  const { workflow, loading, error, refresh } = useWorkflowStatus(workflowId);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  const handleNodeStatus = useCallback(
    (event: NodeStatusSseEvent) => {
      // Refresh DB-persisted status after each node transition
      if (event.type === 'step' || event.type === 'job' || event.type === 'workflow') {
        void refresh();
      }
    },
    [refresh],
  );

  const handleRunComplete = useCallback(
    (_event: RunCompleteSseEvent) => {
      setActiveRunId(null);
      void refresh();
    },
    [refresh],
  );

  useRunEvents({
    runId: activeRunId,
    onNodeStatus: handleNodeStatus,
    onRunComplete: handleRunComplete,
  });

  async function triggerRun() {
    setTriggering(true);
    try {
      const { runId } = await apiClient.workflows.triggerRun(workflowId);
      setActiveRunId(runId);
      void refresh();
    } catch (err) {
      console.error('Failed to trigger run:', err);
    } finally {
      setTriggering(false);
    }
  }

  if (loading) return <FullPageSpinner />;
  if (error || !workflow) return <ErrorMessage message={error ?? 'Workflow not found'} onRetry={refresh} />;

  const isRunning = workflow.status === 'running' || activeRunId !== null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={workflow.name}
          subtitle={`Project: ${workflow.project_id || '(none)'} · Event: ${workflow.event}`}
          action={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => void refresh()}>
                <RefreshCw className="size-3.5" />
                Refresh
              </Button>
              <Button
                size="sm"
                loading={triggering || isRunning}
                onClick={() => void triggerRun()}
              >
                <Play className="size-3.5" />
                {isRunning ? 'Running…' : 'Run'}
              </Button>
            </div>
          }
        />
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <StatusBadge status={workflow.status} />
          {workflow.finished_at && (
            <span>Finished {new Date(workflow.finished_at).toLocaleString()}</span>
          )}
        </div>
      </Card>

      <div className="space-y-3">
        {workflow.jobs.map((job) => (
          <JobPanel key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Job accordion panel
// ---------------------------------------------------------------------------

interface JobPanelProps {
  job: JobRow;
}

function JobPanel({ job }: JobPanelProps) {
  const [expanded, setExpanded] = useState(
    job.status === 'running' || job.status === 'failed',
  );

  return (
    <Card className="p-0 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="size-4 text-zinc-500 shrink-0" />
        ) : (
          <ChevronRight className="size-4 text-zinc-500 shrink-0" />
        )}
        <span className="flex-1 text-sm font-medium text-zinc-200">{job.name}</span>
        <StatusBadge status={job.status} />
        {job.finished_at && job.started_at && (
          <span className="text-xs text-zinc-500 shrink-0">
            {durationLabel(job.started_at, job.finished_at)}
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 divide-y divide-zinc-800">
          {job.steps.map((step) => (
            <StepItem key={step.id} step={step} />
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step row with expandable log
// ---------------------------------------------------------------------------

interface StepItemProps {
  step: StepRow;
}

function StepItem({ step }: StepItemProps) {
  const [showLog, setShowLog] = useState(step.status === 'failed');

  return (
    <div>
      <button
        onClick={() => setShowLog((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-800/30 transition-colors"
      >
        <span className="w-4 shrink-0">
          {showLog ? (
            <ChevronDown className="size-3.5 text-zinc-600" />
          ) : (
            <ChevronRight className="size-3.5 text-zinc-600" />
          )}
        </span>
        <span className="flex-1 text-xs text-zinc-300">{step.name}</span>
        <StatusBadge status={step.status} />
        {step.duration_ms !== null && (
          <span className="text-xs text-zinc-500 shrink-0">{step.duration_ms}ms</span>
        )}
      </button>
      {showLog && (
        <div className="px-4 pb-3">
          <LogViewer log={step.log} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function durationLabel(startedAt: string, finishedAt: string): string {
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
