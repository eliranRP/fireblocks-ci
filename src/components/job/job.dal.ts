import { getDb } from '../../libraries/db/db.js';
import type { JobRow, JobStatus } from './job.types.js';
import { NotFoundError } from '../../libraries/error-handler/errors.js';
import { v4 as uuidv4 } from 'uuid';

export function insertJob(workflowId: string, name: string, position: number): JobRow {
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    'INSERT INTO jobs (id, workflow_id, name, position) VALUES (?, ?, ?, ?)',
  ).run(id, workflowId, name, position);
  return findById(id);
}

export function findById(id: string): JobRow {
  const db = getDb();
  const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as unknown as JobRow | undefined;
  if (!row) throw new NotFoundError(`Job ${id}`);
  return row;
}

export function findByWorkflowId(workflowId: string): JobRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM jobs WHERE workflow_id = ? ORDER BY position').all(workflowId) as unknown as JobRow[];
}

export function updateStatus(
  id: string,
  status: JobStatus,
  timestamps: { started_at?: string; finished_at?: string } = {},
): void {
  const db = getDb();
  const { started_at, finished_at } = timestamps;
  db.prepare(
    'UPDATE jobs SET status = ?, started_at = COALESCE(?, started_at), finished_at = COALESCE(?, finished_at) WHERE id = ?',
  ).run(status, started_at ?? null, finished_at ?? null, id);
}
