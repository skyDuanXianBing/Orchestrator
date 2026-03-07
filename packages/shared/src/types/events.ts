// ============================================
// types/events.ts — SSE 事件类型定义
// ============================================

/** SSE 事件名称枚举 */
export enum SSEEventType {
  PIPELINE_STARTED = "pipeline_started",
  PHASE_STARTED = "phase_started",
  PHASE_COMPLETED = "phase_completed",
  PHASE_FAILED = "phase_failed",
  GATE_PASSED = "gate_passed",
  GATE_FAILED = "gate_failed",
  ARBITRATION_STARTED = "arbitration_started",
  ARBITRATION_COMPLETED = "arbitration_completed",
  ARBITRATION_AUTO_ACTION_APPLIED = "arbitration_auto_action_applied",
  HUMAN_REVIEW_REQUIRED = "human_review_required",
  HUMAN_REVIEW_COMPLETED = "human_review_completed",
  CIRCUIT_BREAKER_TRIGGERED = "circuit_breaker_triggered",
  PIPELINE_COMPLETED = "pipeline_completed",
  PIPELINE_FAILED = "pipeline_failed",
  PIPELINE_ABORTED = "pipeline_aborted",
  LOG_MESSAGE = "log_message",
  BLACKBOARD_UPDATED = "blackboard_updated",
}

/** SSE 事件基础结构 */
export interface SSEEvent {
  type: SSEEventType;
  taskId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/** 阶段开始事件数据 */
export interface PhaseStartedData {
  phaseId: string;
  agent: string | null;
  description: string;
  phaseIndex: number;
  totalPhases: number;
}

/** 阶段完成事件数据 */
export interface PhaseCompletedData {
  phaseId: string;
  agent: string | null;
  summary: string | null;
  artifacts: string[];
  duration: number;  // 毫秒
}

/** 阶段失败事件数据 */
export interface PhaseFailedData {
  phaseId: string;
  agent: string | null;
  errorSummary: string | null;
  retryCount: number;
  maxRetries: number;
  willRetry: boolean;
}

/** 人类审阅事件数据 */
export interface HumanReviewData {
  phaseId: string;
  docPath: string;
  docContent: string | null;
}

/** 日志消息数据 */
export interface LogMessageData {
  level: "info" | "warn" | "error" | "debug";
  message: string;
  agent: string | null;
  phaseId: string | null;
}
