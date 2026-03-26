import { Card, CardHeader } from '../../core';

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Settings</h1>
        <p className="mt-0.5 text-sm text-zinc-400">API keys and account preferences</p>
      </div>

      <Card>
        <CardHeader
          title="API Keys"
          subtitle="Use API keys to authenticate programmatic access."
        />
        <div className="rounded-md border border-dashed border-zinc-700 p-6 text-center">
          <p className="text-sm text-zinc-500">
            API key management will be available once authentication is configured.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Backend Info" />
        <div className="space-y-2 text-sm text-zinc-400">
          <p>
            <span className="text-zinc-500">API base:</span>{' '}
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-indigo-300">
              http://localhost:3000
            </code>
          </p>
          <p>
            <span className="text-zinc-500">Health check:</span>{' '}
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-indigo-300">
              GET /health
            </code>
          </p>
        </div>
      </Card>
    </div>
  );
}
