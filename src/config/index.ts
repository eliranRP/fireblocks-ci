export const config = {
  port: Number(process.env['PORT'] ?? 3000),
  dbPath: process.env['DB_PATH'] ?? './ci.db',
  logLevel: process.env['LOG_LEVEL'] ?? 'info',
  workDir: process.env['WORK_DIR'] ?? '/tmp/ci-runs',
} as const;
