// ============================================
// db/repositories/phase-repository.ts — 阶段表读写
// ============================================

import type { PhaseRuntime } from "@orchestrator/shared";
import { PhaseStatus, PhaseType } from "@orchestrator/shared";
import type { DatabaseSync } from "node:sqlite";
import { runInTransaction } from "../database.js";

interface PhaseRow {
  task_id: string;
  phase_id: string;
  phase_type: string;
  agent: string | null;
  status: string;
  retry_count: number;
  started_at: string | null;
  finished_at: string | null;
  session_id: string | null;
  opencode_task_id: string | null;
  error_summary: string | null;
  summary: string | null;
  artifacts_json: string;
  changed_files_json: string;
  commands_executed_json: string;
}

function parseStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const result: string[] = [];
    for (const item of parsed) {
      if (typeof item === "string") {
        result.push(item);
      }
    }
    return result;
  } catch {
    return [];
  }
}

export class PhaseRepository {
  constructor(private readonly database: DatabaseSync) {}

  upsertPhases(taskId: string, phases: Record<string, PhaseRuntime>): void {
    const statement = this.database.prepare(`
      INSERT INTO phases (
        task_id,
        phase_id,
        phase_type,
        agent,
        status,
        retry_count,
        started_at,
        finished_at,
        session_id,
        opencode_task_id,
        error_summary,
        summary,
        artifacts_json,
        changed_files_json,
        commands_executed_json
      ) VALUES (
        @task_id,
        @phase_id,
        @phase_type,
        @agent,
        @status,
        @retry_count,
        @started_at,
        @finished_at,
        @session_id,
        @opencode_task_id,
        @error_summary,
        @summary,
        @artifacts_json,
        @changed_files_json,
        @commands_executed_json
      )
      ON CONFLICT(task_id, phase_id) DO UPDATE SET
        phase_type = excluded.phase_type,
        agent = excluded.agent,
        status = excluded.status,
        retry_count = excluded.retry_count,
        started_at = excluded.started_at,
        finished_at = excluded.finished_at,
        session_id = excluded.session_id,
        opencode_task_id = excluded.opencode_task_id,
        error_summary = excluded.error_summary,
        summary = excluded.summary,
        artifacts_json = excluded.artifacts_json,
        changed_files_json = excluded.changed_files_json,
        commands_executed_json = excluded.commands_executed_json
    `);

    const rows: Array<{ phaseId: string; runtime: PhaseRuntime }> = [];
    for (const [phaseId, runtime] of Object.entries(phases)) {
      rows.push({ phaseId, runtime });
    }

    runInTransaction(this.database, (): void => {
      for (const row of rows) {
        statement.run({
          task_id: taskId,
          phase_id: row.phaseId,
          phase_type: row.runtime.phaseType,
          agent: row.runtime.agent,
          status: row.runtime.status,
          retry_count: row.runtime.retryCount,
          started_at: row.runtime.startedAt,
          finished_at: row.runtime.finishedAt,
          session_id: row.runtime.sessionId,
          opencode_task_id: row.runtime.taskId,
          error_summary: row.runtime.errorSummary,
          summary: row.runtime.summary,
          artifacts_json: JSON.stringify(row.runtime.artifacts),
          changed_files_json: JSON.stringify(row.runtime.changedFiles),
          commands_executed_json: JSON.stringify(row.runtime.commandsExecuted),
        });
      }
    });
  }

  getPhaseRuntimeMap(taskId: string): Record<string, PhaseRuntime> {
    const statement = this.database.prepare(`
      SELECT
        task_id,
        phase_id,
        phase_type,
        agent,
        status,
        retry_count,
        started_at,
        finished_at,
        session_id,
        opencode_task_id,
        error_summary,
        summary,
        artifacts_json,
        changed_files_json,
        commands_executed_json
      FROM phases
      WHERE task_id = ?
      ORDER BY id ASC
    `);

    const rows = statement.all(taskId) as unknown as PhaseRow[];
    const runtimeMap: Record<string, PhaseRuntime> = {};

    for (const row of rows) {
      runtimeMap[row.phase_id] = {
        phaseType: row.phase_type as PhaseType,
        agent: row.agent as PhaseRuntime["agent"],
        status: row.status as PhaseStatus,
        retryCount: Number(row.retry_count),
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        sessionId: row.session_id,
        taskId: row.opencode_task_id,
        artifacts: parseStringArray(row.artifacts_json),
        changedFiles: parseStringArray(row.changed_files_json),
        commandsExecuted: parseStringArray(row.commands_executed_json),
        readFiles: [],
        operations: [],
        operationsSeq: 0,
        errorSummary: row.error_summary,
        summary: row.summary,
      };
    }

    return runtimeMap;
  }
}
