// ============================================
// types/pipeline.ts — 流水线核心类型
// ============================================

import type { OperationTimelineEntry } from "./blackboard.js";

/** 任务分类 */
export enum Category {
  MODIFY = "A",   // Bug 修复、逻辑变更
  ADD = "B",      // 新功能、新文件
  DELETE = "C",   // 移除功能
  READ = "D",     // 查询、日志
}

/** 执行模式 */
export enum Mode {
  FAST = "FAST",
  BALANCED = "BALANCED",
  COMPREHENSIVE = "COMPREHENSIVE",
  HARDENING = "HARDENING",
}

/** 子代理名称（与 markdown 文件名严格一致） */
export enum AgentName {
  SPEC_CLARIFIER = "spec_clarifier",
  CONTEXT_BUILDER = "context_builder",
  TEST_RED_AUTHOR = "test_red_author",
  IMPL_GREEN_CODER = "impl_green_coder",
  QUALITY_ASSURANCE = "quality_assurance",
  REFACTOR_REVIEWER = "refactor_reviewer",
  COMPLIANCE_AUDITOR = "compliance_auditor",
  SECURITY_REVIEWER = "security_reviewer",
  PERF_REVIEWER = "perf_reviewer",
  DEPENDENCY_GUARD = "dependency_guard",
  RELEASE_GATE = "release_gate",
}

/** 阶段状态 */
export enum PhaseStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  SKIPPED = "SKIPPED",
  APPROVED_BY_HUMAN = "APPROVED_BY_HUMAN",
}

/** 阶段类型 */
export enum PhaseType {
  AGENT_GATE = "AGENT_GATE",       // 子代理执行 + 门禁验证
  HUMAN_REVIEW = "HUMAN_REVIEW",   // 人类审阅门禁 (Phase 0R)
}

/** 单个阶段定义（不可变） */
export interface PhaseDefinition {
  readonly phaseId: string;
  readonly type: PhaseType;
  readonly agent: AgentName | null;   // HUMAN_REVIEW 时为 null
  readonly description: string;
  readonly gateCondition: string;     // 人类可读的门禁条件描述
}

/** 阶段运行时状态 */
export interface PhaseRuntime {
  phaseType: PhaseType;
  agent: AgentName | null;
  status: PhaseStatus;
  retryCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  sessionId: string | null;
  taskId: string | null;
  artifacts: string[];
  changedFiles: string[];
  commandsExecuted: string[];
  readFiles?: string[];
  operations?: OperationTimelineEntry[];
  operationsSeq?: number;
  errorSummary: string | null;
  summary: string | null;
}

/** 流水线定义 = 阶段定义数组 */
export type PipelineDefinition = readonly PhaseDefinition[];

/** 流水线运行时状态 */
export interface PipelineState {
  taskId: string;
  category: Category;
  mode: Mode;
  currentPhaseIndex: number;
  phases: Record<string, PhaseRuntime>;
  docPath: string;
  projectPath: string;
  userRequirement: string;
  createdAt: string;
  updatedAt: string;
}

/** 流水线总体状态 */
export enum PipelineStatus {
  IDLE = "IDLE",
  RUNNING = "RUNNING",
  PAUSED_FOR_REVIEW = "PAUSED_FOR_REVIEW",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  ABORTED = "ABORTED",
}

/** 任务摘要（用于列表展示） */
export interface TaskSummary {
  taskId: string;
  category: Category;
  mode: Mode;
  userRequirement: string;
  pipelineStatus: PipelineStatus;
  currentPhaseId: string | null;
  totalPhases: number;
  completedPhases: number;
  createdAt: string;
  updatedAt: string;
}
