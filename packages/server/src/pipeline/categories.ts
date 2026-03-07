// ============================================
// pipeline/categories.ts — Category 阶段定义工厂
// ============================================

import { AgentName, Category as PipelineCategory, PhaseType } from "@orchestrator/shared";
import type { Category, PhaseDefinition } from "@orchestrator/shared";

/** Category A: MODIFY — FAST 基线 */
const CATEGORY_A_PHASES: readonly PhaseDefinition[] = [
  {
    phaseId: "phase_0",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.TECH_SCOUT,
    description: "Tech Scout：澄清需求并构建上下文",
    gateCondition: "验收标准与代码上下文已明确",
  },
  {
    phaseId: "phase_0r",
    type: PhaseType.HUMAN_REVIEW,
    agent: null,
    description: "人类审阅需求文档",
    gateCondition: "用户明确批准",
  },
  {
    phaseId: "phase_1",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.IMPL_GREEN_CODER,
    description: "编写实现代码（Green）",
    gateCondition: "实现代码已编写",
  },
  {
    phaseId: "phase_2",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.QUALITY_ASSURANCE,
    description: "执行构建/测试验证",
    gateCondition: "测试全绿 + 证据有效",
  },
];

/** Category B: ADD — 新功能 */
const CATEGORY_B_PHASES: readonly PhaseDefinition[] = [
  {
    phaseId: "phase_0",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.TECH_SCOUT,
    description: "Tech Scout：澄清需求并构建上下文",
    gateCondition: "需求与代码上下文已明确",
  },
  {
    phaseId: "phase_0r",
    type: PhaseType.HUMAN_REVIEW,
    agent: null,
    description: "人类审阅需求文档",
    gateCondition: "用户明确批准",
  },
  {
    phaseId: "phase_1",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.IMPL_GREEN_CODER,
    description: "编写实现代码",
    gateCondition: "实现代码已编写",
  },
  {
    phaseId: "phase_2",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.QUALITY_ASSURANCE,
    description: "执行构建/测试验证",
    gateCondition: "测试全绿 + 证据有效",
  },
];

/** Category C: DELETE — 移除功能 */
const CATEGORY_C_PHASES: readonly PhaseDefinition[] = [
  {
    phaseId: "phase_0",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.TECH_SCOUT,
    description: "Tech Scout：澄清删除范围并构建上下文",
    gateCondition: "删除范围与影响上下文已明确",
  },
  {
    phaseId: "phase_0r",
    type: PhaseType.HUMAN_REVIEW,
    agent: null,
    description: "人类审阅删除范围",
    gateCondition: "用户明确批准",
  },
  {
    phaseId: "phase_1",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.IMPL_GREEN_CODER,
    description: "执行删除操作",
    gateCondition: "删除操作已完成",
  },
  {
    phaseId: "phase_2",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.QUALITY_ASSURANCE,
    description: "验证删除后系统完整性",
    gateCondition: "测试全绿 + 无残留引用",
  },
];

/** Category D: READ — 查询、分析 */
const CATEGORY_D_PHASES: readonly PhaseDefinition[] = [
  {
    phaseId: "phase_0",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.TECH_SCOUT,
    description: "Tech Scout：构建代码上下文",
    gateCondition: "上下文已构建",
  },
  {
    phaseId: "phase_1",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.IMPL_GREEN_CODER,
    description: "生成分析结果",
    gateCondition: "分析报告已生成",
  },
];

const MINI_HUMAN_CONFIRM_PHASE: PhaseDefinition = {
  phaseId: "phase_0r",
  type: PhaseType.HUMAN_REVIEW,
  agent: null,
  description: "MINI 轻量确认",
  gateCondition: "用户明确批准",
};

const MINI_MODIFY_ADD_DELETE_PHASES: readonly PhaseDefinition[] = [
  {
    phaseId: "phase_0",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.TECH_SCOUT,
    description: "Tech Scout：快速上下文与任务确认",
    gateCondition: "上下文已确认",
  },
  MINI_HUMAN_CONFIRM_PHASE,
  {
    phaseId: "phase_1",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.IMPL_GREEN_CODER,
    description: "编写最小实现",
    gateCondition: "实现代码已编写",
  },
  {
    phaseId: "phase_2",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.QUALITY_ASSURANCE,
    description: "执行构建检查",
    gateCondition: "构建检查通过",
  },
];

const MINI_READ_PHASES: readonly PhaseDefinition[] = [
  {
    phaseId: "phase_0",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.TECH_SCOUT,
    description: "Tech Scout：快速查询与回答",
    gateCondition: "已输出查询结果",
  },
];

/** 根据 Category 获取基础阶段定义 */
export function getBasePhases(category: Category): readonly PhaseDefinition[] {
  switch (category) {
    case PipelineCategory.MODIFY:
      return CATEGORY_A_PHASES;
    case PipelineCategory.ADD:
      return CATEGORY_B_PHASES;
    case PipelineCategory.DELETE:
      return CATEGORY_C_PHASES;
    case PipelineCategory.READ:
      return CATEGORY_D_PHASES;
    default:
      return CATEGORY_A_PHASES;
  }
}

export function getMiniOverridePhases(category: Category): readonly PhaseDefinition[] {
  switch (category) {
    case PipelineCategory.MODIFY:
    case PipelineCategory.ADD:
    case PipelineCategory.DELETE:
      return MINI_MODIFY_ADD_DELETE_PHASES;
    case PipelineCategory.READ:
      return MINI_READ_PHASES;
    default:
      return MINI_MODIFY_ADD_DELETE_PHASES;
  }
}
