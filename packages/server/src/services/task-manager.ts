// ============================================
// services/task-manager.ts — 多任务生命周期管理
// ============================================

import type {
  CreateTaskRequest,
  CreateTaskResponse,
  TaskDetailResponse,
  TaskListResponse,
  ReviewRequest,
  ReviewResponse,
  StartPipelineResponse,
  AbortPipelineResponse,
  BlackboardJson,
  PhaseRecord,
  PhaseRuntime,
  PipelineState,
} from "@orchestrator/shared";
import { PipelineStatus, PhaseStatus, PhaseType } from "@orchestrator/shared";
import { PipelineStateMachine } from "../core/state-machine.js";
import {
  BlackboardManager,
  type BlackboardPersistenceDeps,
} from "../core/blackboard.js";
import { GateVerifier } from "../core/gate-verifier.js";
import { CircuitBreaker } from "../core/circuit-breaker.js";
import { OpencodeClientManager } from "../core/client.js";
import { PipelineRunner } from "../pipeline/runner.js";
import { EventBus } from "../utils/event-bus.js";
import { Logger } from "../utils/logger.js";
import { generateTaskId } from "../utils/id-generator.js";
import type { PersistedTaskRuntime } from "../db/repositories/task-repository.js";
import { TaskRepository } from "../db/repositories/task-repository.js";
import { PhaseRepository } from "../db/repositories/phase-repository.js";
import {
  BlackboardSnapshotRepository,
} from "../db/repositories/blackboard-snapshot-repository.js";

/** 单个任务的运行时上下文 */
interface TaskContext {
  taskId: string;
  stateMachine: PipelineStateMachine;
  blackboard: BlackboardManager;
  circuitBreaker: CircuitBreaker;
  runner: PipelineRunner | null;
  pipelineStatus: PipelineStatus;
  /** 用于 Phase 0R 审阅的 resolve 回调 */
  reviewResolve: ((input: ReviewRequest) => void) | null;
}

function parseBlackboardJson(raw: string): BlackboardJson {
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("黑板 JSON 格式非法");
  }
  return parsed as BlackboardJson;
}

function mapPhaseRecordToRuntime(record: PhaseRecord): PhaseRuntime {
  return {
    phaseType: record.type as PhaseType,
    agent: record.agent as PhaseRuntime["agent"],
    status: record.status as PhaseStatus,
    retryCount: record.retry_count,
    startedAt: record.started_at,
    finishedAt: record.finished_at,
    sessionId: record.session_id,
    taskId: record.task_id,
    artifacts: [...record.artifact_pointers],
    changedFiles: [...record.changed_files],
    commandsExecuted: [...record.commands_executed],
    readFiles: record.read_files ? [...record.read_files] : [],
    operations: record.operations ? [...record.operations] : [],
    operationsSeq: record.operations_seq ?? 0,
    errorSummary: record.error_summary,
    summary: record.summary,
  };
}

export class TaskManager {
  private tasks: Map<string, TaskContext> = new Map();

  private blackboardDeps: BlackboardPersistenceDeps;

  constructor(
    private eventBus: EventBus,
    private logger: Logger,
    private clientManager: OpencodeClientManager,
    private taskRepository: TaskRepository,
    private phaseRepository: PhaseRepository,
    private snapshotRepository: BlackboardSnapshotRepository,
  ) {
    this.blackboardDeps = {
      taskRepository: this.taskRepository,
      phaseRepository: this.phaseRepository,
      snapshotRepository: this.snapshotRepository,
    };

    this.hydrateTasksFromDatabase();
  }

  /** 创建新任务 */
  createTask(request: CreateTaskRequest): CreateTaskResponse {
    const taskId = generateTaskId();
    const projectPath = request.projectPath ?? ".";

    const blackboard = this.createBlackboardManager(taskId, projectPath);
    const circuitBreaker = new CircuitBreaker();
    const stateMachine = new PipelineStateMachine(
      taskId,
      request.category,
      request.mode,
      request.requirement,
      projectPath,
      blackboard,
    );

    const context: TaskContext = {
      taskId,
      stateMachine,
      blackboard,
      circuitBreaker,
      runner: null,
      pipelineStatus: PipelineStatus.IDLE,
      reviewResolve: null,
    };

    this.tasks.set(taskId, context);

    const currentPhase = stateMachine.getCurrentPhase();
    const currentPhaseId = currentPhase ? currentPhase.phaseId : null;
    blackboard.initialize(stateMachine.getState(), currentPhaseId);

    this.logger.info(`任务已创建: ${taskId} [${request.category}/${request.mode}]`);

    const state = stateMachine.getState();

    return {
      taskId,
      category: request.category,
      mode: request.mode,
      pipelineStatus: PipelineStatus.IDLE,
      totalPhases: stateMachine.getTotalPhases(),
      createdAt: state.createdAt,
    };
  }

  /** 获取任务列表 */
  listTasks(): TaskListResponse {
    const tasks = this.taskRepository.listTaskSummaries();
    return { tasks, total: tasks.length };
  }

  /** 获取任务详情 */
  getTaskDetail(taskId: string): TaskDetailResponse | null {
    const detail = this.taskRepository.getTaskDetail(taskId);
    if (!detail) {
      return null;
    }

    const blackboardData = this.readBlackboard(detail.task);

    return {
      taskId: detail.task.taskId,
      category: detail.task.category,
      mode: detail.task.mode,
      userRequirement: detail.task.userRequirement,
      pipelineStatus: detail.task.pipelineStatus,
      currentPhaseId: detail.task.currentPhaseId,
      totalPhases: detail.totalPhases,
      completedPhases: detail.completedPhases,
      blackboard: blackboardData,
      createdAt: detail.task.createdAt,
      updatedAt: detail.task.updatedAt,
    };
  }

  /** 删除任务 */
  deleteTask(taskId: string): boolean {
    const task = this.taskRepository.getTaskRuntime(taskId);
    if (!task) {
      return false;
    }

    if (
      task.pipelineStatus === PipelineStatus.RUNNING
      || task.pipelineStatus === PipelineStatus.PAUSED_FOR_REVIEW
    ) {
      throw new Error(`任务 ${taskId} 正在运行中，请先中止`);
    }

    const ctx = this.tasks.get(taskId);
    if (ctx && ctx.runner) {
      void ctx.runner.abort();
    }

    this.tasks.delete(taskId);
    this.taskRepository.deleteTask(taskId);
    this.logger.info(`任务已删除: ${taskId}`);
    return true;
  }

  /** 启动流水线 */
  async startPipeline(taskId: string): Promise<StartPipelineResponse> {
    const ctx = this.getOrCreateTaskContext(taskId);
    if (!ctx) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    if (ctx.pipelineStatus === PipelineStatus.RUNNING) {
      throw new Error(`任务 ${taskId} 已在运行中`);
    }

    this.setPipelineStatus(ctx, PipelineStatus.RUNNING);

    const gateVerifier = new GateVerifier();
    const runner = new PipelineRunner(
      ctx.stateMachine,
      gateVerifier,
      ctx.circuitBreaker,
      this.eventBus,
      this.logger,
      {
        taskId: ctx.taskId,
        blackboard: ctx.blackboard,
        getPipelineStatus: () => ctx.pipelineStatus,
        setPipelineStatus: (status: PipelineStatus) => {
          this.setPipelineStatus(ctx, status);
        },
        waitForReview: () => new Promise<ReviewRequest>((resolve) => {
          ctx.reviewResolve = resolve;
        }),
        getClient: (projectPath: string) => this.clientManager.getClient(projectPath),
      },
    );
    ctx.runner = runner;

    // 异步启动流水线（不阻塞 HTTP 响应）
    runner.run().then(() => {
      if (ctx.pipelineStatus === PipelineStatus.ABORTED) {
        this.logger.info(`流水线已中止: ${taskId}`);
        return;
      }

      if (ctx.pipelineStatus !== PipelineStatus.FAILED) {
        this.setPipelineStatus(ctx, PipelineStatus.COMPLETED);
        this.logger.info(`流水线完成: ${taskId}`);
      }
    }).catch((err: Error) => {
      if (ctx.pipelineStatus !== PipelineStatus.ABORTED) {
        this.setPipelineStatus(ctx, PipelineStatus.FAILED);
      }
      this.logger.error(`流水线失败: ${taskId}`, err.message);
    });

    return {
      taskId,
      pipelineStatus: PipelineStatus.RUNNING,
      message: "流水线已启动",
    };
  }

  /** 中止流水线 */
  abortPipeline(taskId: string): AbortPipelineResponse {
    const ctx = this.getOrCreateTaskContext(taskId);
    if (!ctx) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    this.setPipelineStatus(ctx, PipelineStatus.ABORTED);

    if (ctx.runner) {
      void ctx.runner.abort();
    }

    // 如果正在等待人类审阅，主动释放等待，避免 runner 卡死
    if (ctx.reviewResolve) {
      ctx.reviewResolve({ action: "approve", comment: "aborted_by_user" });
      ctx.reviewResolve = null;
    }

    this.logger.info(`流水线已中止: ${taskId}`);

    return {
      taskId,
      pipelineStatus: PipelineStatus.ABORTED,
      message: "流水线已中止",
    };
  }

  /** 处理人类审阅 */
  async handleReview(taskId: string, review: ReviewRequest): Promise<ReviewResponse> {
    const ctx = this.getOrCreateTaskContext(taskId);
    if (!ctx) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    if (ctx.pipelineStatus !== PipelineStatus.PAUSED_FOR_REVIEW) {
      throw new Error(`任务 ${taskId} 当前不在审阅状态`);
    }

    // 通知 runner 继续
    if (ctx.reviewResolve) {
      ctx.reviewResolve(review);
      ctx.reviewResolve = null;
    }

    const currentPhase = ctx.stateMachine.getCurrentPhase();

    return {
      phaseId: currentPhase?.phaseId ?? "unknown",
      action: review.action,
      result: review.action === "approve" ? "已批准" : "已提交修改意见",
    };
  }

  /** 获取活跃任务数 */
  getActiveTaskCount(): number {
    return this.taskRepository.countActiveTasks();
  }

  /** 获取可用代理列表 */
  getAvailableAgents(): Array<{ name: string; description: string }> {
    return [
      { name: "spec_clarifier", description: "需求澄清 → 验收标准" },
      { name: "context_builder", description: "构建代码上下文 → 黑板" },
      { name: "test_red_author", description: "编写失败测试（Red）" },
      { name: "impl_green_coder", description: "编写实现代码（Green）" },
      { name: "quality_assurance", description: "执行构建/测试验证" },
      { name: "refactor_reviewer", description: "重构（保持行为不变）" },
      { name: "compliance_auditor", description: "三合一静态审计" },
      { name: "security_reviewer", description: "安全审计" },
      { name: "perf_reviewer", description: "性能审计" },
      { name: "dependency_guard", description: "依赖审计" },
      { name: "release_gate", description: "发布门禁决策" },
    ];
  }

  private createBlackboardManager(taskId: string, projectPath: string): BlackboardManager {
    return new BlackboardManager(taskId, projectPath, this.blackboardDeps);
  }

  private setPipelineStatus(ctx: TaskContext, status: PipelineStatus): void {
    ctx.pipelineStatus = status;
    this.taskRepository.updatePipelineStatus(ctx.taskId, status, new Date().toISOString());
  }

  private hydrateTasksFromDatabase(): void {
    const persistedTasks = this.taskRepository.listTaskRuntimes();
    for (const task of persistedTasks) {
      try {
        const context = this.buildContextFromPersistedTask(task);
        this.tasks.set(task.taskId, context);
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown hydration error";
        this.logger.warn(`任务上下文恢复失败: ${task.taskId}`, message);
      }
    }
  }

  private getOrCreateTaskContext(taskId: string): TaskContext | null {
    const existing = this.tasks.get(taskId);
    if (existing) {
      return existing;
    }

    const persistedTask = this.taskRepository.getTaskRuntime(taskId);
    if (!persistedTask) {
      return null;
    }

    const context = this.buildContextFromPersistedTask(persistedTask);
    this.tasks.set(taskId, context);
    return context;
  }

  private buildContextFromPersistedTask(task: PersistedTaskRuntime): TaskContext {
    const blackboard = this.createBlackboardManager(task.taskId, task.projectPath);
    const state = this.buildPipelineState(task);
    const stateMachine = new PipelineStateMachine(
      task.taskId,
      task.category,
      task.mode,
      task.userRequirement,
      task.projectPath,
      blackboard,
      state,
    );

    return {
      taskId: task.taskId,
      stateMachine,
      blackboard,
      circuitBreaker: new CircuitBreaker(),
      runner: null,
      pipelineStatus: task.pipelineStatus,
      reviewResolve: null,
    };
  }

  private buildPipelineState(task: PersistedTaskRuntime): PipelineState {
    const phasesFromBlackboard = this.tryBuildPhasesFromBlackboard(task.blackboardLatestJson);
    const phases = Object.keys(phasesFromBlackboard).length > 0
      ? phasesFromBlackboard
      : this.phaseRepository.getPhaseRuntimeMap(task.taskId);

    return {
      taskId: task.taskId,
      category: task.category,
      mode: task.mode,
      currentPhaseIndex: task.currentPhaseIndex,
      phases,
      docPath: task.docPath,
      projectPath: task.projectPath,
      userRequirement: task.userRequirement,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  private tryBuildPhasesFromBlackboard(rawBlackboardJson: string): Record<string, PhaseRuntime> {
    const phases: Record<string, PhaseRuntime> = {};

    try {
      const blackboard = parseBlackboardJson(rawBlackboardJson);
      for (const [phaseId, record] of Object.entries(blackboard.phases)) {
        phases[phaseId] = mapPhaseRecordToRuntime(record);
      }
    } catch {
      // Ignore invalid blackboard payload and return empty phases.
    }

    return phases;
  }

  private readBlackboard(task: PersistedTaskRuntime): BlackboardJson {
    try {
      return parseBlackboardJson(task.blackboardLatestJson);
    } catch {
      const latestSnapshot = this.snapshotRepository.getLatestSnapshot(task.taskId);
      if (latestSnapshot) {
        return latestSnapshot.blackboard;
      }

      throw new Error(`任务 ${task.taskId} 的黑板数据损坏`);
    }
  }
}
