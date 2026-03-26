interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="rounded-md border border-red-800 bg-red-950/30 p-4 text-sm text-red-400">
      <p className="font-medium">Something went wrong</p>
      <p className="mt-1 text-red-400/80">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 text-xs text-red-300 underline hover:text-red-100"
        >
          Try again
        </button>
      )}
    </div>
  );
}
