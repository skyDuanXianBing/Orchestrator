// ============================================
// pipeline/modes.ts — 模式追加阶段定义
// ============================================

import { AgentName, PhaseType } from "@orchestrator/shared";
import type { Mode, PhaseDefinition } from "@orchestrator/shared";

/** COMPREHENSIVE 模式追加阶段 */
const COMPREHENSIVE_EXTRA: readonly PhaseDefinition[] = [
  {
    phaseId: "phase_audit",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.COMPLIANCE_AUDITOR,
    description: "三合一静态审计",
    gateCondition: "审计报告已生成",
  },
];

/** HARDENING 模式追加阶段 */
const HARDENING_EXTRA: readonly PhaseDefinition[] = [
  {
    phaseId: "phase_audit",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.COMPLIANCE_AUDITOR,
    description: "三合一静态审计",
    gateCondition: "审计报告已生成",
  },
  {
    phaseId: "phase_security",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.SECURITY_REVIEWER,
    description: "安全审计",
    gateCondition: "无 CRITICAL/HIGH 安全发现",
  },
  {
    phaseId: "phase_perf",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.PERF_REVIEWER,
    description: "性能审计",
    gateCondition: "无 CRITICAL/HIGH 性能问题",
  },
  {
    phaseId: "phase_deps",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.DEPENDENCY_GUARD,
    description: "依赖审计",
    gateCondition: "无 BLOCK 级依赖风险",
  },
  {
    phaseId: "phase_release",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.RELEASE_GATE,
    description: "发布门禁决策",
    gateCondition: "GO 决策",
  },
];

/** 根据 Mode 获取追加阶段 */
export function getModeExtraPhases(mode: Mode): readonly PhaseDefinition[] {
  switch (mode) {
    case "FAST":
      return [];
    case "BALANCED":
      return [];
    case "COMPREHENSIVE":
      return COMPREHENSIVE_EXTRA;
    case "HARDENING":
      return HARDENING_EXTRA;
    default:
      return [];
  }
}
