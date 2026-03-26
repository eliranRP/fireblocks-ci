import { clsx } from 'clsx';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = { sm: 'size-4', md: 'size-6', lg: 'size-10' };

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <span
      className={clsx(
        'inline-block animate-spin rounded-full border-2 border-zinc-600 border-t-indigo-500',
        sizeClasses[size],
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex h-full flex-1 items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
