CREATE TABLE IF NOT EXISTS jobs (
  id          TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  name        TEXT NOT NULL,
  position    INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  started_at  DATETIME,
  finished_at DATETIME
);
