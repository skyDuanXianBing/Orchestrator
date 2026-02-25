// ============================================
// db/database.ts — SQLite 连接与 Schema 初始化
// ============================================

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_DATABASE_DIR = "data";
const DEFAULT_DATABASE_FILE = "orchestrator.sqlite";
const DATABASE_PATH_ENV = "ORCHESTRATOR_DB_PATH";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tasks (
  task_id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  mode TEXT NOT NULL,
  user_requirement TEXT NOT NULL,
  project_path TEXT NOT NULL,
  doc_path TEXT NOT NULL,
  pipeline_status TEXT NOT NULL,
  current_phase_index INTEGER NOT NULL,
  current_phase_id TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  blackboard_latest_json TEXT NOT NULL DEFAULT '{}',
  blackboard_version INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tasks_updated_at
  ON tasks(updated_at);

CREATE INDEX IF NOT EXISTS idx_tasks_pipeline_status
  ON tasks(pipeline_status);

CREATE TABLE IF NOT EXISTS phases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  phase_id TEXT NOT NULL,
  phase_type TEXT NOT NULL,
  agent TEXT NULL,
  status TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NULL,
  finished_at TEXT NULL,
  session_id TEXT NULL,
  opencode_task_id TEXT NULL,
  error_summary TEXT NULL,
  summary TEXT NULL,
  artifacts_json TEXT NOT NULL DEFAULT '[]',
  changed_files_json TEXT NOT NULL DEFAULT '[]',
  commands_executed_json TEXT NOT NULL DEFAULT '[]',
  UNIQUE(task_id, phase_id)
);

CREATE INDEX IF NOT EXISTS idx_phases_task
  ON phases(task_id);

CREATE INDEX IF NOT EXISTS idx_phases_task_status
  ON phases(task_id, status);

CREATE TABLE IF NOT EXISTS sse_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  type TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  phase_id TEXT NULL,
  level TEXT NULL,
  agent TEXT NULL,
  message TEXT NULL,
  data_json TEXT NOT NULL,
  UNIQUE(task_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_events_task_seq
  ON sse_events(task_id, seq);

CREATE INDEX IF NOT EXISTS idx_events_task_time
  ON sse_events(task_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_events_type
  ON sse_events(type);

CREATE TABLE IF NOT EXISTS blackboard_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  reason TEXT NOT NULL,
  blackboard_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(task_id, version)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_task_version
  ON blackboard_snapshots(task_id, version);
`;

export type SqliteDatabase = DatabaseSync;

let globalDatabase: SqliteDatabase | null = null;

function ensureParentDirectory(databasePath: string): void {
  const parentDir = path.dirname(databasePath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }
}

function applyPragmas(database: SqliteDatabase): void {
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA synchronous = NORMAL");
  database.exec("PRAGMA busy_timeout = 5000");
}

function initializeSchema(database: SqliteDatabase): void {
  database.exec(SCHEMA_SQL);
}

export function resolveDatabasePath(explicitPath?: string): string {
  if (explicitPath && explicitPath.trim().length > 0) {
    return path.resolve(explicitPath);
  }

  const envPath = process.env[DATABASE_PATH_ENV];
  if (envPath && envPath.trim().length > 0) {
    return path.resolve(envPath);
  }

  return path.resolve(process.cwd(), DEFAULT_DATABASE_DIR, DEFAULT_DATABASE_FILE);
}

export function createDatabaseConnection(explicitPath?: string): SqliteDatabase {
  const databasePath = resolveDatabasePath(explicitPath);
  ensureParentDirectory(databasePath);

  const database = new DatabaseSync(databasePath);
  applyPragmas(database);
  initializeSchema(database);
  return database;
}

export function runInTransaction<T>(database: SqliteDatabase, operation: () => T): T {
  database.exec("BEGIN");
  try {
    const result = operation();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // Ignore rollback errors and rethrow original error.
    }
    throw error;
  }
}

export function initializeDatabase(explicitPath?: string): SqliteDatabase {
  if (globalDatabase) {
    return globalDatabase;
  }

  globalDatabase = createDatabaseConnection(explicitPath);
  return globalDatabase;
}

export function getDatabase(): SqliteDatabase {
  if (!globalDatabase) {
    return initializeDatabase();
  }

  return globalDatabase;
}

export function closeDatabase(): void {
  if (!globalDatabase) {
    return;
  }

  globalDatabase.close();
  globalDatabase = null;
}
