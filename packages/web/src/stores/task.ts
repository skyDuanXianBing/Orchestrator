// ============================================
// stores/task.ts — Pinia 任务状态管理
// ============================================

import { ref } from "vue";
import { defineStore } from "pinia";
import type {
  TaskSummary,
  TaskDetailResponse,
  CreateTaskRequest,
  CreateTaskResponse,
  StartPipelineResponse,
  AbortPipelineResponse,
  TaskListResponse,
  ReviewRequest,
  ReviewResponse,
  HealthResponse,
} from "@orchestrator/shared";
import { httpGet, httpPost, httpDelete } from "../utils/http";
import { i18n } from "../i18n";

/** Agent 信息 */
export interface AgentInfo {
  name: string;
  description: string;
}

/** 获取当前翻译函数（非组件上下文安全） */
function t(key: string): string {
  return i18n.global.t(key);
}

export const useTaskStore = defineStore("task", () => {
  // ─── State ───
  const tasks = ref<TaskSummary[]>([]);
  const totalTasks = ref(0);
  const currentTask = ref<TaskDetailResponse | null>(null);
  const agents = ref<AgentInfo[]>([]);
  const health = ref<HealthResponse | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // ─── Internal Helpers ───
  function setLoading(value: boolean): void {
    loading.value = value;
  }

  function setError(message: string | null): void {
    error.value = message;
  }

  // ─── Actions ───

  /** 获取任务列表 */
  async function fetchTasks(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const result = await httpGet<TaskListResponse>("/api/task");
      tasks.value = result.tasks;
      totalTasks.value = result.total;
    } catch (err) {
      const message = err instanceof Error ? err.message : t("store.fetchTasksFailed");
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  /** 获取任务详情 */
  async function fetchTaskDetail(taskId: string): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const result = await httpGet<TaskDetailResponse>(`/api/task/${taskId}`);
      currentTask.value = result;
    } catch (err) {
      const message = err instanceof Error ? err.message : t("store.fetchDetailFailed");
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  /** 创建任务 */
  async function createTask(request: CreateTaskRequest): Promise<CreateTaskResponse | null> {
    setLoading(true);
    setError(null);
    try {
      const result = await httpPost<CreateTaskResponse>("/api/task", request);
      // 创建后刷新列表
      await fetchTasks();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : t("store.createTaskFailed");
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  /** 删除任务 */
  async function deleteTask(taskId: string): Promise<boolean> {
    setError(null);
    try {
      await httpDelete<{ taskId: string }>(`/api/task/${taskId}`);
      // 删除后刷新列表
      await fetchTasks();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : t("store.deleteTaskFailed");
      setError(message);
      return false;
    }
  }

  /** 启动流水线 */
  async function startPipeline(taskId: string): Promise<StartPipelineResponse | null> {
    setError(null);
    try {
      const result = await httpPost<StartPipelineResponse>(`/api/pipeline/${taskId}/start`);
      // 启动后刷新详情
      await fetchTaskDetail(taskId);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : t("store.startPipelineFailed");
      setError(message);
      return null;
    }
  }

  /** 中止流水线 */
  async function abortPipeline(taskId: string): Promise<AbortPipelineResponse | null> {
    setError(null);
    try {
      const result = await httpPost<AbortPipelineResponse>(`/api/pipeline/${taskId}/abort`);
      // 中止后刷新详情
      await fetchTaskDetail(taskId);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : t("store.abortPipelineFailed");
      setError(message);
      return null;
    }
  }

  /** 提交人类审阅 */
  async function submitReview(
    taskId: string,
    review: ReviewRequest,
  ): Promise<ReviewResponse | null> {
    setError(null);
    try {
      const result = await httpPost<ReviewResponse>(
        `/api/pipeline/${taskId}/review`,
        review,
      );
      // 审阅后刷新详情
      await fetchTaskDetail(taskId);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : t("store.submitReviewFailed");
      setError(message);
      return null;
    }
  }

  /** 获取健康状态 */
  async function fetchHealth(): Promise<void> {
    try {
      const result = await httpGet<HealthResponse>("/api/health");
      health.value = result;
    } catch {
      health.value = null;
    }
  }

  /** 获取代理列表 */
  async function fetchAgents(): Promise<void> {
    try {
      const result = await httpGet<AgentInfo[]>("/api/agents");
      agents.value = result;
    } catch {
      agents.value = [];
    }
  }

  return {
    // State
    tasks,
    totalTasks,
    currentTask,
    agents,
    health,
    loading,
    error,
    // Actions
    fetchTasks,
    fetchTaskDetail,
    createTask,
    deleteTask,
    startPipeline,
    abortPipeline,
    submitReview,
    fetchHealth,
    fetchAgents,
  };
});
