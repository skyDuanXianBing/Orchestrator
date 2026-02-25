// ============================================
// core/blackboard.ts — 黑板管理器（SQLite 持久化）
// ============================================

import path from "node:path";
import fs from "node:fs";
import type {
  BlackboardJson,
  GlobalContext,
  PhaseRecord,
  PhaseRuntime,
  PipelineState,
} from "@orchestrator/shared";
import { PipelineStatus } from "@orchestrator/shared";
import { createDatabaseConnection } from "../db/database.js";
import {
  BlackboardSnapshotRepository,
} from "../db/repositories/blackboard-snapshot-repository.js";
import { PhaseRepository } from "../db/repositories/phase-repository.js";
import { TaskRepository } from "../db/repositories/task-repository.js";

const DATA_DIR = "data";
const LEGACY_BLACKBOARD_DIR = "tasks";
const DEFAULT_REASON = "state_update";

export interface BlackboardPersistenceDeps {
  taskRepository: TaskRepository;
  phaseRepository: PhaseRepository;
  snapshotRepository: BlackboardSnapshotRepository;
}

function parseBlackboardJson(raw: string): BlackboardJson {
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("黑板 JSON 格式非法");
  }
  return parsed as BlackboardJson;
}

export class BlackboardManager {
  private readonly taskId: string;
  private readonly filePath: string;
  private readonly taskRepository: TaskRepository | null;
  private readonly phaseRepository: PhaseRepository | null;
  private readonly snapshotRepository: BlackboardSnapshotRepository | null;

  constructor(taskId: string, projectPath: string, deps?: BlackboardPersistenceDeps) {
    this.taskId = taskId;
    const legacyDir = path.join(projectPath, DATA_DIR, LEGACY_BLACKBOARD_DIR);
    this.filePath = path.join(legacyDir, `${taskId}.json`);

    if (deps) {
      this.taskRepository = deps.taskRepository;
      this.phaseRepository = deps.phaseRepository;
      this.snapshotRepository = deps.snapshotRepository;
      return;
    }

    try {
      const dbPath = path.join(projectPath, DATA_DIR, "orchestrator.sqlite");
      const database = createDatabaseConnection(dbPath);
      this.taskRepository = new TaskRepository(database);
      this.phaseRepository = new PhaseRepository(database);
      this.snapshotRepository = new BlackboardSnapshotRepository(database);
    } catch {
      // 在 native 绑定不可用时，回退到文件模式以维持最小可用性（主要用于测试环境）。
      this.taskRepository = null;
      this.phaseRepository = null;
      this.snapshotRepository = null;
    }
  }

  /** 初始化黑板持久化 */
  initialize(state: Readonly<PipelineState>, currentPhaseId?: string | null): void {
    this.write(state, "initialize", currentPhaseId);
  }

  /** 读取黑板 JSON */
  read(): BlackboardJson {
    if (!this.taskRepository) {
      return this.readFromFile();
    }

    const task = this.taskRepository.getTaskRuntime(this.taskId);
    if (!task) {
      throw new Error(`黑板记录不存在: ${this.taskId}`);
    }

    return parseBlackboardJson(task.blackboardLatestJson);
  }

  /** 写入黑板 JSON（从 PipelineState 转换） */
  write(
    state: Readonly<PipelineState>,
    reason: string = DEFAULT_REASON,
    currentPhaseId?: string | null,
  ): void {
    if (!this.taskRepository || !this.phaseRepository || !this.snapshotRepository) {
      this.writeToFile(state);
      return;
    }

    const previousTask = this.taskRepository.getTaskRuntime(this.taskId);
    const previousBlackboard = this.tryReadBlackboard(previousTask?.blackboardLatestJson);
    const preservedGlobalContext = previousBlackboard?.global_context ?? null;
    const blackboard = this.stateToBlackboard(state, preservedGlobalContext);

    const pipelineStatus = previousTask?.pipelineStatus ?? PipelineStatus.IDLE;
    const blackboardVersion = previousTask?.blackboardVersion ?? 0;
    const resolvedCurrentPhaseId = this.resolveCurrentPhaseId(state, currentPhaseId);

    // 先确保 tasks 主记录存在，再写入带外键约束的 phases/snapshots。
    this.taskRepository.upsertTaskState({
      taskId: state.taskId,
      category: state.category,
      mode: state.mode,
      userRequirement: state.userRequirement,
      projectPath: state.projectPath,
      docPath: state.docPath,
      currentPhaseIndex: state.currentPhaseIndex,
      currentPhaseId: resolvedCurrentPhaseId,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      blackboardLatestJson: JSON.stringify(blackboard),
      blackboardVersion,
      pipelineStatus,
    });

    this.phaseRepository.upsertPhases(this.taskId, state.phases);

    const snapshotVersion = this.snapshotRepository.insertSnapshot(
      this.taskId,
      reason,
      blackboard,
      new Date().toISOString(),
    );

    this.taskRepository.upsertTaskState({
      taskId: state.taskId,
      category: state.category,
      mode: state.mode,
      userRequirement: state.userRequirement,
      projectPath: state.projectPath,
      docPath: state.docPath,
      currentPhaseIndex: state.currentPhaseIndex,
      currentPhaseId: resolvedCurrentPhaseId,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      blackboardLatestJson: JSON.stringify(blackboard),
      blackboardVersion: snapshotVersion,
      pipelineStatus,
    });
  }

  /** 兼容旧接口：返回历史文件路径 */
  getFilePath(): string {
    return this.filePath;
  }

  /** PipelineState → BlackboardJson 转换 */
  private stateToBlackboard(
    state: Readonly<PipelineState>,
    globalContext: GlobalContext | null,
  ): BlackboardJson {
    const phases: Record<string, PhaseRecord> = {};

    for (const [phaseId, runtime] of Object.entries(state.phases) as Array<[string, PhaseRuntime]>) {
      phases[phaseId] = {
        type: runtime.phaseType,
        agent: runtime.agent,
        status: runtime.status,
        retry_count: runtime.retryCount,
        started_at: runtime.startedAt,
        finished_at: runtime.finishedAt,
        session_id: runtime.sessionId,
        task_id: runtime.taskId,
        changed_files: runtime.changedFiles,
        commands_executed: runtime.commandsExecuted,
        artifact_pointers: runtime.artifacts,
        read_files: runtime.readFiles ?? [],
        operations: runtime.operations ?? [],
        operations_seq: runtime.operationsSeq ?? 0,
        error_summary: runtime.errorSummary,
        summary: runtime.summary,
      };
    }

    return {
      task_id: state.taskId,
      category: state.category,
      mode: state.mode,
      user_requirement: state.userRequirement,
      doc_path: state.docPath,
      project_path: state.projectPath,
      created_at: state.createdAt,
      updated_at: state.updatedAt,
      global_context: globalContext,
      phases,
    };
  }

  private resolveCurrentPhaseId(
    state: Readonly<PipelineState>,
    currentPhaseId?: string | null,
  ): string | null {
    if (currentPhaseId !== undefined) {
      return currentPhaseId;
    }

    const phaseIds = Object.keys(state.phases);
    if (state.currentPhaseIndex < 0 || state.currentPhaseIndex >= phaseIds.length) {
      return null;
    }

    const resolved = phaseIds[state.currentPhaseIndex];
    if (!resolved) {
      return null;
    }

    return resolved;
  }

  private tryReadBlackboard(rawBlackboard?: string): BlackboardJson | null {
    if (!rawBlackboard) {
      return null;
    }

    try {
      return parseBlackboardJson(rawBlackboard);
    } catch {
      return null;
    }
  }

  private readFromFile(): BlackboardJson {
    if (!fs.existsSync(this.filePath)) {
      throw new Error(`黑板文件不存在: ${this.filePath}`);
    }

    const raw = fs.readFileSync(this.filePath, "utf-8");
    return parseBlackboardJson(raw);
  }

  private writeToFile(state: Readonly<PipelineState>): void {
    const previous = this.tryReadBlackboardFromFile();
    const preservedGlobalContext = previous?.global_context ?? null;
    const json = this.stateToBlackboard(state, preservedGlobalContext);

    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.filePath, JSON.stringify(json, null, 2), "utf-8");
  }

  private tryReadBlackboardFromFile(): BlackboardJson | null {
    if (!fs.existsSync(this.filePath)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      return parseBlackboardJson(raw);
    } catch {
      return null;
    }
  }
}
