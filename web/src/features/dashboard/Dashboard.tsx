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
import { CreateWorkflowForm } from '../workflows/CreateWorkflowForm';
import type { WorkflowDetail } from '../../lib/types';

export function Dashboard() {
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
          <h1 className="text-xl font-semibold text-zinc-100">Workflows</h1>
          <p className="mt-0.5 text-sm text-zinc-400">
            {workflows.length} workflow{workflows.length !== 1 ? 's' : ''} defined
          </p>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)}>
          <Plus className="size-4" />
          New Workflow
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {workflows.map((wf) => (
            <WorkflowCard
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

interface WorkflowCardProps {
  workflow: WorkflowDetail;
  onClick: () => void;
}

function WorkflowCard({ workflow, onClick }: WorkflowCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-600 hover:bg-zinc-800/60 transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-100">{workflow.name}</p>
          <p className="mt-0.5 truncate text-xs text-zinc-500">
            {workflow.project_id || 'No project'} · {workflow.event}
          </p>
        </div>
        <StatusBadge status={workflow.status} />
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        {workflow.jobs.length} job{workflow.jobs.length !== 1 ? 's' : ''}
        {' · '}
        Created {new Date(workflow.created_at).toLocaleDateString()}
      </p>
    </button>
  );
}
