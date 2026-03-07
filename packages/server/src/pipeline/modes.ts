// ============================================
// pipeline/modes.ts — 模式阶段组装定义
// ============================================

import {
  AgentName,
  Category as PipelineCategory,
  Mode as PipelineMode,
  PhaseType,
} from "@orchestrator/shared";
import type { Category, Mode, PhaseDefinition } from "@orchestrator/shared";

const MODIFY_BALANCED_TEST_PHASE: PhaseDefinition = {
  phaseId: "phase_1",
  type: PhaseType.AGENT_GATE,
  agent: AgentName.TEST_RED_AUTHOR,
  description: "编写失败测试（Red）",
  gateCondition: "失败测试证据存在",
};

const MODIFY_BALANCED_REFACTOR_PHASE: PhaseDefinition = {
  phaseId: "phase_4",
  type: PhaseType.AGENT_GATE,
  agent: AgentName.REFACTOR_REVIEWER,
  description: "重构（保持行为不变）",
  gateCondition: "测试仍为绿色",
};

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

function buildModifyBalancedPhases(
  basePhases: readonly PhaseDefinition[],
): readonly PhaseDefinition[] {
  const phase0 = basePhases[0];
  const reviewPhase = basePhases[1];
  const implPhase = basePhases[2];
  const qaPhase = basePhases[3];

  if (!phase0 || !reviewPhase || !implPhase || !qaPhase) {
    return basePhases;
  }

  return [
    phase0,
    reviewPhase,
    MODIFY_BALANCED_TEST_PHASE,
    {
      ...implPhase,
      phaseId: "phase_2",
    },
    {
      ...qaPhase,
      phaseId: "phase_3",
    },
    MODIFY_BALANCED_REFACTOR_PHASE,
  ];
}

export function getModePhases(
  category: Category,
  mode: Mode,
  basePhases: readonly PhaseDefinition[],
): readonly PhaseDefinition[] {
  if (category === PipelineCategory.MODIFY) {
    const balancedPhases = buildModifyBalancedPhases(basePhases);

    switch (mode) {
      case PipelineMode.MINI:
      case PipelineMode.FAST:
        return basePhases;
      case PipelineMode.BALANCED:
        return balancedPhases;
      case PipelineMode.COMPREHENSIVE:
        return [...balancedPhases, ...COMPREHENSIVE_EXTRA];
      case PipelineMode.HARDENING:
        return [...balancedPhases, ...HARDENING_EXTRA];
      default:
        return basePhases;
    }
  }

  switch (mode) {
    case PipelineMode.MINI:
    case PipelineMode.FAST:
    case PipelineMode.BALANCED:
      return basePhases;
    case PipelineMode.COMPREHENSIVE:
      return [...basePhases, ...COMPREHENSIVE_EXTRA];
    case PipelineMode.HARDENING:
      return [...basePhases, ...HARDENING_EXTRA];
    default:
      return basePhases;
  }
}

/** 根据 Mode 获取通用追加阶段（不含 Category A 的插入式重排） */
export function getModeExtraPhases(mode: Mode): readonly PhaseDefinition[] {
  switch (mode) {
    case PipelineMode.MINI:
      return [];
    case PipelineMode.FAST:
      return [];
    case PipelineMode.BALANCED:
      return [];
    case PipelineMode.COMPREHENSIVE:
      return COMPREHENSIVE_EXTRA;
    case PipelineMode.HARDENING:
      return HARDENING_EXTRA;
    default:
      return [];
  }
}
