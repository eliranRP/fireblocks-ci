import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { Button } from '../../core';
import type { CreateJobInput, CreateWorkflowInput, WorkflowDetail } from '../../lib/types';

interface CreateWorkflowFormProps {
  onCreated: (workflow: WorkflowDetail) => void;
}

type StepDraft = { name: string; command: string };
type JobDraft  = { name: string; steps: StepDraft[] };

const emptyStep = (): StepDraft => ({ name: '', command: '' });
const emptyJob  = (): JobDraft  => ({ name: '', steps: [emptyStep()] });

export function CreateWorkflowForm({ onCreated }: CreateWorkflowFormProps) {
  const [name, setName]       = useState('');
  const [event, setEvent]     = useState('push');
  const [projectId, setProjectId] = useState('');
  const [jobs, setJobs]       = useState<JobDraft[]>([emptyJob()]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  function updateJob(jobIdx: number, patch: Partial<JobDraft>) {
    setJobs((prev) =>
      prev.map((j, i) => (i === jobIdx ? { ...j, ...patch } : j)),
    );
  }

  function updateStep(jobIdx: number, stepIdx: number, patch: Partial<StepDraft>) {
    setJobs((prev) =>
      prev.map((j, i) =>
        i !== jobIdx
          ? j
          : {
              ...j,
              steps: j.steps.map((s, si) => (si === stepIdx ? { ...s, ...patch } : s)),
            },
      ),
    );
  }

  function addJob() {
    setJobs((prev) => [...prev, emptyJob()]);
  }

  function removeJob(jobIdx: number) {
    setJobs((prev) => prev.filter((_, i) => i !== jobIdx));
  }

  function addStep(jobIdx: number) {
    setJobs((prev) =>
      prev.map((j, i) => (i === jobIdx ? { ...j, steps: [...j.steps, emptyStep()] } : j)),
    );
  }

  function removeStep(jobIdx: number, stepIdx: number) {
    setJobs((prev) =>
      prev.map((j, i) =>
        i !== jobIdx ? j : { ...j, steps: j.steps.filter((_, si) => si !== stepIdx) },
      ),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const input: CreateWorkflowInput = {
      name,
      event,
      projectId,
      jobs: jobs.map((j): CreateJobInput => ({
        name: j.name,
        steps: j.steps.map((s) => ({ name: s.name, type: 'shell', command: s.command })),
      })),
    };

    try {
      const workflow = await apiClient.workflows.create(input);
      onCreated(workflow);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workflow');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
      {/* Workflow metadata */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-zinc-300">Workflow</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Name" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Pipeline"
              required
              className={inputCls}
            />
          </Field>
          <Field label="Event">
            <input
              value={event}
              onChange={(e) => setEvent(e.target.value)}
              placeholder="push"
              className={inputCls}
            />
          </Field>
          <Field label="Project ID">
            <input
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="project-abc"
              className={inputCls}
            />
          </Field>
        </div>
      </fieldset>

      {/* Jobs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-300">Jobs</p>
          <Button type="button" variant="ghost" size="sm" onClick={addJob}>
            <Plus className="size-3.5" /> Add job
          </Button>
        </div>

        {jobs.map((job, ji) => (
          <div key={ji} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Field label={`Job ${ji + 1} name`} className="flex-1">
                <input
                  value={job.name}
                  onChange={(e) => updateJob(ji, { name: e.target.value })}
                  placeholder="build"
                  required
                  className={inputCls}
                />
              </Field>
              {jobs.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-5 text-red-400 hover:text-red-300"
                  onClick={() => removeJob(ji)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>

            {/* Steps */}
            <div className="space-y-2 pl-2 border-l border-zinc-700">
              {job.steps.map((step, si) => (
                <div key={si} className="flex items-end gap-2">
                  <Field label="Step name" className="w-36 shrink-0">
                    <input
                      value={step.name}
                      onChange={(e) => updateStep(ji, si, { name: e.target.value })}
                      placeholder="install"
                      required
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Shell command" className="flex-1">
                    <input
                      value={step.command}
                      onChange={(e) => updateStep(ji, si, { command: e.target.value })}
                      placeholder="npm install"
                      required
                      className={`${inputCls} font-mono`}
                    />
                  </Field>
                  {job.steps.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 mb-0.5"
                      onClick={() => removeStep(ji, si)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addStep(ji)}
              >
                <Plus className="size-3.5" /> Add step
              </Button>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="rounded-md border border-red-800 bg-red-950/30 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" loading={loading}>
          Create Workflow
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Field wrapper — label + input slot
// ---------------------------------------------------------------------------

interface FieldProps {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

function Field({ label, required, className, children }: FieldProps) {
  return (
    <label className={`block space-y-1 ${className ?? ''}`}>
      <span className="text-xs font-medium text-zinc-400">
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  'w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';
