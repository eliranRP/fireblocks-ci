import { useParams, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { WorkflowRunDetail } from './WorkflowRunDetail';

export function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) return <p className="text-sm text-zinc-400">Invalid workflow ID.</p>;

  return (
    <div className="space-y-4">
      <Link
        to="/workflows"
        className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
      >
        <ChevronLeft className="size-4" />
        All workflows
      </Link>
      <WorkflowRunDetail workflowId={id} />
    </div>
  );
}
