import { eq, asc, sql } from 'drizzle-orm';
import { getDb } from '../../libraries/db/db.js';
import { jobs } from '../../libraries/db/schema.js';
import type { JobRow, JobStatus } from './job.types.js';
import { NotFoundError } from '../../libraries/error-handler/errors.js';

export function findById(id: string): JobRow {
  const row = getDb().select().from(jobs).where(eq(jobs.id, id)).get();
  if (!row) throw new NotFoundError(`Job ${id}`);
  return row as JobRow;
}

export function findByWorkflowId(workflowId: string): JobRow[] {
  return getDb()
    .select()
    .from(jobs)
    .where(eq(jobs.workflow_id, workflowId))
    .orderBy(asc(jobs.position))
    .all() as JobRow[];
}

export function updateStatus(
  id: string,
  status: JobStatus,
  timestamps: { started_at?: string; finished_at?: string } = {},
): void {
  const { started_at, finished_at } = timestamps;
  getDb()
    .update(jobs)
    .set({
      status,
      started_at:  started_at  ? started_at  : sql<string>`started_at`,
      finished_at: finished_at ? finished_at : sql<string>`finished_at`,
    })
    .where(eq(jobs.id, id))
    .run();
}
