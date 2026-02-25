// ============================================
// db/repositories/blackboard-snapshot-repository.ts — 黑板快照读写
// ============================================

import type { BlackboardJson } from "@orchestrator/shared";
import type { DatabaseSync } from "node:sqlite";
import { runInTransaction } from "../database.js";

interface SnapshotRow {
  task_id: string;
  version: number;
  reason: string;
  blackboard_json: string;
  created_at: string;
}

interface NextVersionRow {
  next_version: number;
}

export interface PersistedBlackboardSnapshot {
  taskId: string;
  version: number;
  reason: string;
  blackboard: BlackboardJson;
  createdAt: string;
}

function parseBlackboardJson(raw: string): BlackboardJson | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as BlackboardJson;
  } catch {
    return null;
  }
}

export class BlackboardSnapshotRepository {
  constructor(private readonly database: DatabaseSync) {}

  insertSnapshot(
    taskId: string,
    reason: string,
    blackboard: BlackboardJson,
    createdAt: string,
  ): number {
    const nextVersionStatement = this.database.prepare(`
      SELECT COALESCE(MAX(version), 0) + 1 AS next_version
      FROM blackboard_snapshots
      WHERE task_id = ?
    `);

    const insertStatement = this.database.prepare(`
      INSERT INTO blackboard_snapshots (
        task_id,
        version,
        reason,
        blackboard_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?)
    `);

    return runInTransaction(this.database, (): number => {
      const row = nextVersionStatement.get(taskId) as NextVersionRow | undefined;
      const nextVersion = row ? Number(row.next_version) : 1;

      insertStatement.run(taskId, nextVersion, reason, JSON.stringify(blackboard), createdAt);

      return nextVersion;
    });
  }

  getLatestSnapshot(taskId: string): PersistedBlackboardSnapshot | null {
    const statement = this.database.prepare(`
      SELECT
        task_id,
        version,
        reason,
        blackboard_json,
        created_at
      FROM blackboard_snapshots
      WHERE task_id = ?
      ORDER BY version DESC
      LIMIT 1
    `);

    const row = statement.get(taskId) as SnapshotRow | undefined;
    if (!row) {
      return null;
    }

    const blackboard = parseBlackboardJson(row.blackboard_json);
    if (!blackboard) {
      return null;
    }

    return {
      taskId: row.task_id,
      version: Number(row.version),
      reason: row.reason,
      blackboard,
      createdAt: row.created_at,
    };
  }
}
