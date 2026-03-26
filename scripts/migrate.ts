import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSqlite as getDb } from '../src/libraries/db/db.js';
import { logger } from '../src/libraries/logger/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '../src/libraries/db/migrations');

export function runMigrations(): void {
  const db = getDb();
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    db.exec(sql);
    logger.info({ file }, 'Migration applied');
  }
}
