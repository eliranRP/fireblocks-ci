import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../libraries/db/db.js';
import { workflows } from '../../libraries/db/schema.js';
import type { WorkflowRow, WorkflowStatus } from './workflow.types.js';
import { NotFoundError } from '../../libraries/error-handler/errors.js';

export function findById(id: string): WorkflowRow {
  const row = getDb().select().from(workflows).where(eq(workflows.id, id)).get();
  if (!row) throw new NotFoundError(`Workflow ${id}`);
  return row as WorkflowRow;
}

export function updateStatus(
  id: string,
  status: WorkflowStatus,
  timestamps: { started_at?: string; finished_at?: string } = {},
): void {
  const { started_at, finished_at } = timestamps;
  getDb()
    .update(workflows)
    .set({
      status,
      started_at:  started_at  ? started_at  : sql<string>`started_at`,
      finished_at: finished_at ? finished_at : sql<string>`finished_at`,
    })
    .where(eq(workflows.id, id))
    .run();
}
