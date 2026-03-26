import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, GitBranch } from 'lucide-react';
import { useWorkflowList } from '../../hooks/useWorkflowList';
import {
  Button,
  Card,
  CardHeader,
  StatusBadge,
  FullPageSpinner,
  ErrorMessage,
  EmptyState,
} from '../../core';
import { CreateWorkflowForm } from './CreateWorkflowForm';
import type { WorkflowDetail } from '../../lib/types';

export function WorkflowListPage() {
  const { workflows, loading, error, refresh } = useWorkflowList();
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  function handleCreated(workflow: WorkflowDetail) {
    setShowCreate(false);
    void refresh();
    navigate(`/workflows/${workflow.id}`);
  }

  if (loading) return <FullPageSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={() => void refresh()} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">All Workflows</h1>
          <p className="mt-0.5 text-sm text-zinc-400">
            {workflows.length} workflow{workflows.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)}>
          <Plus className="size-4" /> New Workflow
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader title="Create Workflow" />
          <CreateWorkflowForm onCreated={handleCreated} />
        </Card>
      )}

      {workflows.length === 0 && !showCreate ? (
        <EmptyState
          icon={<GitBranch className="size-8" />}
          title="No workflows yet"
          description="Create your first workflow to start running CI pipelines."
          action={
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="size-3.5" /> Create workflow
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {workflows.map((wf) => (
            <WorkflowRow
              key={wf.id}
              workflow={wf}
              onClick={() => navigate(`/workflows/${wf.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface WorkflowRowProps {
  workflow: WorkflowDetail;
  onClick: () => void;
}

function WorkflowRow({ workflow, onClick }: WorkflowRowProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 hover:border-zinc-600 hover:bg-zinc-800/60 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-100">{workflow.name}</p>
        <p className="truncate text-xs text-zinc-500 mt-0.5">
          {workflow.project_id || 'No project'} · {workflow.event} ·{' '}
          {workflow.jobs.length} job{workflow.jobs.length !== 1 ? 's' : ''}
        </p>
      </div>
      <StatusBadge status={workflow.status} />
      <p className="text-xs text-zinc-500 shrink-0">
        {new Date(workflow.created_at).toLocaleDateString()}
      </p>
    </button>
  );
}
