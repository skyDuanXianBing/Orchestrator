// ============================================
// shared/src/index.ts — 统一导出
// ============================================

// Pipeline types
export {
  Category,
  Mode,
  AgentName,
  PhaseStatus,
  PhaseType,
  PipelineStatus,
} from "./types/pipeline.js";

export type {
  PhaseDefinition,
  PhaseRuntime,
  ArbitrationDecision,
  ArbitrationDecisionAction,
  ArbitrationRiskLevel,
  ArbitrationReviewContext,
  PipelineDefinition,
  PipelineState,
  TaskSummary,
} from "./types/pipeline.js";

// Blackboard types
export type {
  BlackboardJson,
  GlobalContext,
  PhaseRecord,
  OperationTimelineEntry,
  OperationState,
  OperationTarget,
  OperationRedaction,
} from "./types/blackboard.js";

// Agent result types
export type { AgentStructuredResult } from "./types/agent-result.js";
export { parseAgentResult } from "./types/agent-result.js";

// SSE event types
export { SSEEventType } from "./types/events.js";
export type {
  SSEEvent,
  PhaseStartedData,
  PhaseCompletedData,
  PhaseFailedData,
  HumanReviewData,
  LogMessageData,
} from "./types/events.js";

// API types
export type {
  ApiResponse,
  CreateTaskRequest,
  CreateTaskResponse,
  TaskDetailResponse,
  TaskListResponse,
  ReviewRequest,
  ReviewResponse,
  StartPipelineResponse,
  AbortPipelineResponse,
  HealthResponse,
} from "./types/api.js";
