// ============================================
// types/blackboard.ts — 黑板 JSON Schema 类型
// ============================================

import type {
  AgentName,
  ArbitrationDecision,
  ArbitrationReviewContext,
  PhaseStatus,
  PhaseType,
} from "./pipeline.js";

export type OperationState = "STARTED" | "COMPLETED" | "FAILED";

export interface OperationTarget {
  kind: string;
  value: string;
  display?: string;
}

export interface OperationRedaction {
  applied: boolean;
  rules: string[];
  replaced_count: number;
}

export interface OperationTimelineEntry {
  op_id: string;
  seq: number;
  ts: string;
  phase_id: string;
  agent: string | null;
  op_type: string;
  state: OperationState;
  label: string;
  target?: OperationTarget;
  meta?: Record<string, unknown>;
  redaction?: OperationRedaction;
}

/** 黑板 JSON 完整结构（= PipelineState 的持久化形式） */
export interface BlackboardJson {
  task_id: string;
  category: string;
  mode: string;
  user_requirement: string;
  doc_path: string;
  project_path: string;
  created_at: string;
  updated_at: string;
  global_context: GlobalContext | null;
  phases: Record<string, PhaseRecord>;
}

/** 全局上下文（由 tech_scout / context_builder 填充） */
export interface GlobalContext {
  relevant_files: string[];
  api_contracts: string[];
  critical_logic: string[];
  downstream_prompt: string;
}

/** 单个阶段的持久化记录 */
export interface PhaseRecord {
  type: PhaseType;
  agent: AgentName | null;
  status: PhaseStatus;
  retry_count: number;
  started_at: string | null;
  finished_at: string | null;
  session_id: string | null;
  task_id: string | null;
  changed_files: string[];
  commands_executed: string[];
  artifact_pointers: string[];
  read_files?: string[];
  operations?: OperationTimelineEntry[];
  operations_seq?: number;
  error_summary: string | null;
  summary: string | null;
  arbitration?: ArbitrationDecision;
  review_context?: ArbitrationReviewContext;
}
