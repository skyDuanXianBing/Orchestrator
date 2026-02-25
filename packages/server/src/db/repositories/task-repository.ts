// ============================================
// db/repositories/task-repository.ts — 任务表读写
// ============================================

import type { Category, Mode, PipelineStatus, TaskSummary } from "@orchestrator/shared";
import type { DatabaseSync } from "node:sqlite";

interface TaskSummaryRow {
  task_id: string;
  category: string;
  mode: string;
  user_requirement: string;
  pipeline_status: string;
  current_phase_id: string | null;
  created_at: string;
  updated_at: string;
  total_phases: number;
  completed_phases: number;
}

interface TaskRuntimeRow {
  task_id: string;
  category: string;
  mode: string;
  user_requirement: string;
  project_path: string;
  doc_path: string;
  pipeline_status: string;
  current_phase_index: number;
  current_phase_id: string | null;
  created_at: string;
  updated_at: string;
  blackboard_latest_json: string;
  blackboard_version: number;
}

interface CountRow {
  count: number;
}

export interface PersistedTaskRuntime {
  taskId: string;
  category: Category;
  mode: Mode;
  userRequirement: string;
  projectPath: string;
  docPath: string;
  pipelineStatus: PipelineStatus;
  currentPhaseIndex: number;
  currentPhaseId: string | null;
  createdAt: string;
  updatedAt: string;
  blackboardLatestJson: string;
  blackboardVersion: number;
}

export interface PersistTaskStateInput {
  taskId: string;
  category: Category;
  mode: Mode;
  userRequirement: string;
  projectPath: string;
  docPath: string;
  currentPhaseIndex: number;
  currentPhaseId: string | null;
  createdAt: string;
  updatedAt: string;
  blackboardLatestJson: string;
  blackboardVersion: number;
  pipelineStatus?: PipelineStatus | null;
}

export interface PersistedTaskDetail {
  task: PersistedTaskRuntime;
  totalPhases: number;
  completedPhases: number;
}

export class TaskRepository {
  constructor(private readonly database: DatabaseSync) {}

  upsertTaskState(input: PersistTaskStateInput): void {
    const statement = this.database.prepare(`
      INSERT INTO tasks (
        task_id,
        category,
        mode,
        user_requirement,
        project_path,
        doc_path,
        pipeline_status,
        current_phase_index,
        current_phase_id,
        created_at,
        updated_at,
        blackboard_latest_json,
        blackboard_version
      ) VALUES (
        @task_id,
        @category,
        @mode,
        @user_requirement,
        @project_path,
        @doc_path,
        COALESCE(@pipeline_status, 'IDLE'),
        @current_phase_index,
        @current_phase_id,
        @created_at,
        @updated_at,
        @blackboard_latest_json,
        @blackboard_version
      )
      ON CONFLICT(task_id) DO UPDATE SET
        category = excluded.category,
        mode = excluded.mode,
        user_requirement = excluded.user_requirement,
        project_path = excluded.project_path,
        doc_path = excluded.doc_path,
        current_phase_index = excluded.current_phase_index,
        current_phase_id = excluded.current_phase_id,
        updated_at = excluded.updated_at,
        blackboard_latest_json = excluded.blackboard_latest_json,
        blackboard_version = excluded.blackboard_version
    `);

    statement.run({
      task_id: input.taskId,
      category: input.category,
      mode: input.mode,
      user_requirement: input.userRequirement,
      project_path: input.projectPath,
      doc_path: input.docPath,
      pipeline_status: input.pipelineStatus ?? null,
      current_phase_index: input.currentPhaseIndex,
      current_phase_id: input.currentPhaseId,
      created_at: input.createdAt,
      updated_at: input.updatedAt,
      blackboard_latest_json: input.blackboardLatestJson,
      blackboard_version: input.blackboardVersion,
    });
  }

  updatePipelineStatus(taskId: string, status: PipelineStatus, updatedAt: string): void {
    const statement = this.database.prepare(`
      UPDATE tasks
      SET pipeline_status = ?, updated_at = ?
      WHERE task_id = ?
    `);

    statement.run(status, updatedAt, taskId);
  }

  deleteTask(taskId: string): boolean {
    const statement = this.database.prepare("DELETE FROM tasks WHERE task_id = ?");
    const result = statement.run(taskId);
    return result.changes > 0;
  }

  countActiveTasks(): number {
    const statement = this.database.prepare(`
      SELECT COUNT(*) AS count
      FROM tasks
      WHERE pipeline_status IN ('RUNNING', 'PAUSED_FOR_REVIEW')
    `);

    const row = statement.get() as CountRow | undefined;
    if (!row) {
      return 0;
    }

    return Number(row.count);
  }

  listTaskSummaries(): TaskSummary[] {
    const statement = this.database.prepare(`
      SELECT
        t.task_id,
        t.category,
        t.mode,
        t.user_requirement,
        t.pipeline_status,
        t.current_phase_id,
        t.created_at,
        t.updated_at,
        COALESCE(phase_stats.total_phases, 0) AS total_phases,
        COALESCE(phase_stats.completed_phases, 0) AS completed_phases
      FROM tasks t
      LEFT JOIN (
        SELECT
          task_id,
          COUNT(*) AS total_phases,
          SUM(CASE WHEN status IN ('SUCCESS', 'APPROVED_BY_HUMAN') THEN 1 ELSE 0 END) AS completed_phases
        FROM phases
        GROUP BY task_id
      ) AS phase_stats ON phase_stats.task_id = t.task_id
      ORDER BY t.updated_at DESC
    `);

    const rows = statement.all() as unknown as TaskSummaryRow[];
    const result: TaskSummary[] = [];

    for (const row of rows) {
      result.push({
        taskId: row.task_id,
        category: row.category as Category,
        mode: row.mode as Mode,
        userRequirement: row.user_requirement,
        pipelineStatus: row.pipeline_status as PipelineStatus,
        currentPhaseId: row.current_phase_id,
        totalPhases: Number(row.total_phases),
        completedPhases: Number(row.completed_phases),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }

    return result;
  }

  getTaskDetail(taskId: string): PersistedTaskDetail | null {
    const statement = this.database.prepare(`
      SELECT
        t.task_id,
        t.category,
        t.mode,
        t.user_requirement,
        t.project_path,
        t.doc_path,
        t.pipeline_status,
        t.current_phase_index,
        t.current_phase_id,
        t.created_at,
        t.updated_at,
        t.blackboard_latest_json,
        t.blackboard_version,
        COALESCE(phase_stats.total_phases, 0) AS total_phases,
        COALESCE(phase_stats.completed_phases, 0) AS completed_phases
      FROM tasks t
      LEFT JOIN (
        SELECT
          task_id,
          COUNT(*) AS total_phases,
          SUM(CASE WHEN status IN ('SUCCESS', 'APPROVED_BY_HUMAN') THEN 1 ELSE 0 END) AS completed_phases
        FROM phases
        GROUP BY task_id
      ) AS phase_stats ON phase_stats.task_id = t.task_id
      WHERE t.task_id = ?
      LIMIT 1
    `);

    const row = statement.get(taskId) as (TaskRuntimeRow & {
      total_phases: number;
      completed_phases: number;
    }) | undefined;

    if (!row) {
      return null;
    }

    return {
      task: this.mapRuntimeRow(row),
      totalPhases: Number(row.total_phases),
      completedPhases: Number(row.completed_phases),
    };
  }

  getTaskRuntime(taskId: string): PersistedTaskRuntime | null {
    const statement = this.database.prepare(`
      SELECT
        task_id,
        category,
        mode,
        user_requirement,
        project_path,
        doc_path,
        pipeline_status,
        current_phase_index,
        current_phase_id,
        created_at,
        updated_at,
        blackboard_latest_json,
        blackboard_version
      FROM tasks
      WHERE task_id = ?
      LIMIT 1
    `);

    const row = statement.get(taskId) as TaskRuntimeRow | undefined;
    if (!row) {
      return null;
    }

    return this.mapRuntimeRow(row);
  }

  listTaskRuntimes(): PersistedTaskRuntime[] {
    const statement = this.database.prepare(`
      SELECT
        task_id,
        category,
        mode,
        user_requirement,
        project_path,
        doc_path,
        pipeline_status,
        current_phase_index,
        current_phase_id,
        created_at,
        updated_at,
        blackboard_latest_json,
        blackboard_version
      FROM tasks
      ORDER BY created_at ASC
    `);

    const rows = statement.all() as unknown as TaskRuntimeRow[];
    const runtimes: PersistedTaskRuntime[] = [];

    for (const row of rows) {
      runtimes.push(this.mapRuntimeRow(row));
    }

    return runtimes;
  }

  private mapRuntimeRow(row: TaskRuntimeRow): PersistedTaskRuntime {
    return {
      taskId: row.task_id,
      category: row.category as Category,
      mode: row.mode as Mode,
      userRequirement: row.user_requirement,
      projectPath: row.project_path,
      docPath: row.doc_path,
      pipelineStatus: row.pipeline_status as PipelineStatus,
      currentPhaseIndex: Number(row.current_phase_index),
      currentPhaseId: row.current_phase_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      blackboardLatestJson: row.blackboard_latest_json,
      blackboardVersion: Number(row.blackboard_version),
    };
  }
}
