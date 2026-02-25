// ============================================
// types/api.ts — REST API 请求/响应类型
// ============================================

import type { Category, Mode, TaskSummary, PipelineStatus } from "./pipeline.js";
import type { BlackboardJson } from "./blackboard.js";

/** 通用 API 响应包裹 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: string | null;
}

// ─── 创建任务 ───

export interface CreateTaskRequest {
  requirement: string;
  category: Category;
  mode: Mode;
  projectPath?: string;
}

export interface CreateTaskResponse {
  taskId: string;
  category: Category;
  mode: Mode;
  pipelineStatus: PipelineStatus;
  totalPhases: number;
  createdAt: string;
}

// ─── 任务详情 ───

export interface TaskDetailResponse {
  taskId: string;
  category: Category;
  mode: Mode;
  userRequirement: string;
  pipelineStatus: PipelineStatus;
  currentPhaseId: string | null;
  totalPhases: number;
  completedPhases: number;
  blackboard: BlackboardJson;
  createdAt: string;
  updatedAt: string;
}

// ─── 任务列表 ───

export interface TaskListResponse {
  tasks: TaskSummary[];
  total: number;
}

// ─── 人类审阅 ───

export interface ReviewRequest {
  action: "approve" | "revise";
  comment?: string;
}

export interface ReviewResponse {
  phaseId: string;
  action: string;
  result: string;
}

// ─── 启动/中止 ───

export interface StartPipelineResponse {
  taskId: string;
  pipelineStatus: PipelineStatus;
  message: string;
}

export interface AbortPipelineResponse {
  taskId: string;
  pipelineStatus: PipelineStatus;
  message: string;
}

// ─── 健康检查 ───

export interface HealthResponse {
  status: "ok" | "error";
  version: string;
  uptime: number;
  activeTasks: number;
}
