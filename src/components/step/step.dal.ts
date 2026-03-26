import { getDb } from '../../libraries/db/db.js';
import type { StepRow, StepResult, StepStatus } from './step.types.js';
import { NotFoundError } from '../../libraries/error-handler/errors.js';
import { v4 as uuidv4 } from 'uuid';

export function insertStep(
  jobId: string,
  name: string,
  position: number,
  commandType: string,
  commandJson: string,
): StepRow {
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    'INSERT INTO steps (id, job_id, name, position, command_type, command_json) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, jobId, name, position, commandType, commandJson);
  return findById(id);
}

export function findById(id: string): StepRow {
  const db = getDb();
  const row = db.prepare('SELECT * FROM steps WHERE id = ?').get(id) as unknown as StepRow | undefined;
  if (!row) throw new NotFoundError(`Step ${id}`);
  return row;
}

export function findByJobId(jobId: string): StepRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM steps WHERE job_id = ? ORDER BY position').all(jobId) as unknown as StepRow[];
}

export function updateStatus(
  id: string,
  status: StepStatus,
  timestamps: { started_at?: string; finished_at?: string } = {},
): void {
  const db = getDb();
  const { started_at, finished_at } = timestamps;
  db.prepare(
    'UPDATE steps SET status = ?, started_at = COALESCE(?, started_at), finished_at = COALESCE(?, finished_at) WHERE id = ?',
  ).run(status, started_at ?? null, finished_at ?? null, id);
}

export function saveResult(id: string, result: StepResult): void {
  const db = getDb();
  db.prepare(
    'UPDATE steps SET status = ?, log = ?, duration_ms = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?',
  ).run(result.status, result.log, result.duration_ms, id);
}
