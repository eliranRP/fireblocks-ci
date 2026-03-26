import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const workflows = sqliteTable('workflows', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull(),
  event:       text('event').notNull().default('push'),
  project_id:  text('project_id').notNull().default(''),
  status:      text('status', { enum: ['pending', 'running', 'success', 'failed'] as const }).notNull().default('pending'),
  created_at:  text('created_at').default(sql`CURRENT_TIMESTAMP`),
  started_at:  text('started_at'),
  finished_at: text('finished_at'),
});

export const jobs = sqliteTable('jobs', {
  id:          text('id').primaryKey(),
  workflow_id: text('workflow_id').notNull().references(() => workflows.id),
  name:        text('name').notNull(),
  position:    integer('position').notNull(),
  status:      text('status', { enum: ['pending', 'running', 'success', 'failed', 'skipped'] as const }).notNull().default('pending'),
  started_at:  text('started_at'),
  finished_at: text('finished_at'),
});

export const steps = sqliteTable('steps', {
  id:           text('id').primaryKey(),
  job_id:       text('job_id').notNull().references(() => jobs.id),
  name:         text('name').notNull(),
  position:     integer('position').notNull(),
  command_type: text('command_type').notNull(),
  command_json: text('command_json').notNull(),
  status:       text('status', { enum: ['pending', 'running', 'success', 'failed'] as const }).notNull().default('pending'),
  log:          text('log'),
  duration_ms:  integer('duration_ms'),
  started_at:   text('started_at'),
  finished_at:  text('finished_at'),
});
