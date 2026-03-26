import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { config } from '../../config/index.js';
import * as schema from './schema.js';

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let sqlite: DatabaseSync | null = null;
let db: DrizzleDb | null = null;

function init(): void {
  if (sqlite) return;
  sqlite = new DatabaseSync(config.dbPath);
  sqlite.exec('PRAGMA journal_mode = WAL');
  sqlite.exec('PRAGMA foreign_keys = ON');
  // Pass the existing DatabaseSync instance so migrations and drizzle share one connection
  db = drizzle({ client: sqlite, schema });
}

/** Raw DatabaseSync connection — used only by the migration runner. */
export function getSqlite(): DatabaseSync {
  init();
  return sqlite!;
}

/** Drizzle ORM instance — use for all application queries. */
export function getDb(): DrizzleDb {
  init();
  return db!;
}

export function closeDb(): void {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    db = null;
  }
}
