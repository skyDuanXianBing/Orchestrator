// ============================================
// db/repositories/event-repository.ts — SSE 事件表读写
// ============================================

import type { SSEEvent } from "@orchestrator/shared";
import { SSEEventType } from "@orchestrator/shared";
import type { DatabaseSync } from "node:sqlite";
import { runInTransaction } from "../database.js";

interface EventRow {
  task_id: string;
  seq: number;
  type: string;
  timestamp: string;
  phase_id: string | null;
  level: string | null;
  agent: string | null;
  message: string | null;
  data_json: string;
}

interface NextSeqRow {
  next_seq: number;
}

export interface PersistedSSEEvent {
  seq: number;
  event: SSEEvent;
}

function readStringField(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  if (typeof value === "string") {
    return value;
  }
  return null;
}

function parseDataJson(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

export class EventRepository {
  constructor(private readonly database: DatabaseSync) {}

  appendEvent(event: SSEEvent): number {
    const data = event.data;
    const phaseId = readStringField(data, "phaseId");
    const agent = readStringField(data, "agent");

    let level: string | null = null;
    let message: string | null = null;

    if (event.type === SSEEventType.LOG_MESSAGE) {
      level = readStringField(data, "level");
      message = readStringField(data, "message");
    }

    const nextSeqStatement = this.database.prepare(`
      SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq
      FROM sse_events
      WHERE task_id = ?
    `);

    const insertStatement = this.database.prepare(`
      INSERT INTO sse_events (
        task_id,
        seq,
        type,
        timestamp,
        phase_id,
        level,
        agent,
        message,
        data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return runInTransaction(this.database, (): number => {
      const row = nextSeqStatement.get(event.taskId) as NextSeqRow | undefined;
      const nextSeq = row ? Number(row.next_seq) : 1;

      insertStatement.run(
        event.taskId,
        nextSeq,
        event.type,
        event.timestamp,
        phaseId,
        level,
        agent,
        message,
        JSON.stringify(event.data),
      );

      return nextSeq;
    });
  }

  listEventsByTask(taskId: string, lastSeq: number): PersistedSSEEvent[] {
    const statement = this.database.prepare(`
      SELECT
        task_id,
        seq,
        type,
        timestamp,
        phase_id,
        level,
        agent,
        message,
        data_json
      FROM sse_events
      WHERE task_id = ? AND seq > ?
      ORDER BY seq ASC
    `);

    const rows = statement.all(taskId, lastSeq) as unknown as EventRow[];
    const events: PersistedSSEEvent[] = [];

    for (const row of rows) {
      events.push({
        seq: Number(row.seq),
        event: {
          type: row.type as SSEEventType,
          taskId: row.task_id,
          timestamp: row.timestamp,
          data: parseDataJson(row.data_json),
        },
      });
    }

    return events;
  }
}
