CREATE TABLE IF NOT EXISTS steps (
  id           TEXT PRIMARY KEY,
  job_id       TEXT NOT NULL REFERENCES jobs(id),
  name         TEXT NOT NULL,
  position     INTEGER NOT NULL,
  command_type TEXT NOT NULL,
  command_json TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  log          TEXT,
  duration_ms  INTEGER,
  started_at   DATETIME,
  finished_at  DATETIME
);
