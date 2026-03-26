import { eq, asc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../libraries/db/db.js';
import { steps } from '../../libraries/db/schema.js';
import type { StepRow, StepResult, StepStatus } from './step.types.js';
import { NotFoundError } from '../../libraries/error-handler/errors.js';

export function insertStep(
  jobId: string,
  name: string,
  position: number,
  commandType: string,
  commandJson: string,
): StepRow {
  const id = uuidv4();
  getDb()
    .insert(steps)
    .values({ id, job_id: jobId, name, position, command_type: commandType, command_json: commandJson })
    .run();
  return findById(id);
}

export function findById(id: string): StepRow {
  const row = getDb().select().from(steps).where(eq(steps.id, id)).get();
  if (!row) throw new NotFoundError(`Step ${id}`);
  return row as StepRow;
}

export function findByJobId(jobId: string): StepRow[] {
  return getDb()
    .select()
    .from(steps)
    .where(eq(steps.job_id, jobId))
    .orderBy(asc(steps.position))
    .all() as StepRow[];
}

export function updateStatus(
  id: string,
  status: StepStatus,
  timestamps: { started_at?: string; finished_at?: string } = {},
): void {
  const { started_at, finished_at } = timestamps;
  getDb()
    .update(steps)
    .set({
      status,
      started_at:  started_at  ? started_at  : sql<string>`started_at`,
      finished_at: finished_at ? finished_at : sql<string>`finished_at`,
    })
    .where(eq(steps.id, id))
    .run();
}

export function saveResult(id: string, result: StepResult): void {
  getDb()
    .update(steps)
    .set({
      status:      result.status,
      log:         result.log,
      duration_ms: result.duration_ms,
      finished_at: sql<string>`CURRENT_TIMESTAMP`,
    })
    .where(eq(steps.id, id))
    .run();
}
