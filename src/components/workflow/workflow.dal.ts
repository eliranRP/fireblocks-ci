import { getDb } from '../../libraries/db/db.js';
import type { WorkflowRow, WorkflowStatus } from './workflow.types.js';
import { NotFoundError } from '../../libraries/error-handler/errors.js';
import { v4 as uuidv4 } from 'uuid';

export function insertWorkflow(name: string, event: string, projectId: string): WorkflowRow {
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    'INSERT INTO workflows (id, name, event, project_id) VALUES (?, ?, ?, ?)',
  ).run(id, name, event, projectId);
  return findById(id);
}

export function findById(id: string): WorkflowRow {
  const db = getDb();
  const row = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id) as unknown as WorkflowRow | undefined;
  if (!row) throw new NotFoundError(`Workflow ${id}`);
  return row;
}

export function updateStatus(
  id: string,
  status: WorkflowStatus,
  timestamps: { started_at?: string; finished_at?: string } = {},
): void {
  const db = getDb();
  const { started_at, finished_at } = timestamps;
  db.prepare(
    'UPDATE workflows SET status = ?, started_at = COALESCE(?, started_at), finished_at = COALESCE(?, finished_at) WHERE id = ?',
  ).run(status, started_at ?? null, finished_at ?? null, id);
}
