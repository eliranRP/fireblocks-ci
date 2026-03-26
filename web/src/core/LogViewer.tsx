import { clsx } from 'clsx';

interface LogViewerProps {
  log: string | null;
  className?: string;
}

export function LogViewer({ log, className }: LogViewerProps) {
  if (!log) {
    return (
      <p className="px-3 py-2 text-xs text-zinc-500 italic">No output captured.</p>
    );
  }

  return (
    <pre
      className={clsx(
        'overflow-x-auto rounded-md bg-black/50 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-300',
        className,
      )}
    >
      {log}
    </pre>
  );
}
