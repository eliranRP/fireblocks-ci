import { clsx } from 'clsx';
import type { RunStatus } from '../lib/types';

interface StatusBadgeProps {
  status: RunStatus;
  className?: string;
}

const statusConfig: Record<RunStatus, { label: string; classes: string }> = {
  pending: { label: 'Pending',  classes: 'bg-zinc-700 text-zinc-300' },
  running: { label: 'Running',  classes: 'bg-yellow-500/20 text-yellow-300 animate-pulse' },
  success: { label: 'Success',  classes: 'bg-emerald-500/20 text-emerald-400' },
  failed:  { label: 'Failed',   classes: 'bg-red-500/20 text-red-400' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { label, classes } = statusConfig[status];
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        classes,
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
