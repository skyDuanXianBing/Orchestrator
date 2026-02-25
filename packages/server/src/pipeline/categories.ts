// ============================================
// pipeline/categories.ts — Category 阶段定义工厂
// ============================================

import { AgentName, PhaseType } from "@orchestrator/shared";
import type { Category, PhaseDefinition } from "@orchestrator/shared";

/** Category A: MODIFY — Bug 修复、逻辑变更 */
const CATEGORY_A_PHASES: readonly PhaseDefinition[] = [
  {
    phaseId: "phase_0",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.SPEC_CLARIFIER,
    description: "需求澄清 → 验收标准",
    gateCondition: "验收标准已定义",
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
    agent: AgentName.CONTEXT_BUILDER,
    description: "构建代码上下文 → 黑板",
    gateCondition: "global_context 已设置",
  },
  {
    phaseId: "phase_2",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.TEST_RED_AUTHOR,
    description: "编写失败测试（Red）",
    gateCondition: "失败测试证据存在",
  },
  {
    phaseId: "phase_3",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.IMPL_GREEN_CODER,
    description: "编写实现代码（Green）",
    gateCondition: "实现代码已编写",
  },
  {
    phaseId: "phase_4",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.QUALITY_ASSURANCE,
    description: "执行构建/测试验证",
    gateCondition: "测试全绿 + 证据有效",
  },
  {
    phaseId: "phase_5",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.REFACTOR_REVIEWER,
    description: "重构（保持行为不变）",
    gateCondition: "测试仍为绿色",
  },
];

/** Category B: ADD — 新功能 */
const CATEGORY_B_PHASES: readonly PhaseDefinition[] = [
  {
    phaseId: "phase_0",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.SPEC_CLARIFIER,
    description: "需求澄清 → 验收标准",
    gateCondition: "验收标准已定义",
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
    agent: AgentName.CONTEXT_BUILDER,
    description: "构建代码上下文 → 黑板",
    gateCondition: "global_context 已设置",
  },
  {
    phaseId: "phase_2",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.IMPL_GREEN_CODER,
    description: "编写实现代码",
    gateCondition: "实现代码已编写",
  },
  {
    phaseId: "phase_3",
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
    agent: AgentName.SPEC_CLARIFIER,
    description: "需求澄清 → 删除范围确认",
    gateCondition: "删除范围已定义",
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
    agent: AgentName.CONTEXT_BUILDER,
    description: "构建代码上下文 → 影响分析",
    gateCondition: "影响范围已分析",
  },
  {
    phaseId: "phase_2",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.IMPL_GREEN_CODER,
    description: "执行删除操作",
    gateCondition: "删除操作已完成",
  },
  {
    phaseId: "phase_3",
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
    agent: AgentName.CONTEXT_BUILDER,
    description: "构建代码上下文",
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

/** 根据 Category 获取基础阶段定义 */
export function getBasePhases(category: Category): readonly PhaseDefinition[] {
  switch (category) {
    case "A":
      return CATEGORY_A_PHASES;
    case "B":
      return CATEGORY_B_PHASES;
    case "C":
      return CATEGORY_C_PHASES;
    case "D":
      return CATEGORY_D_PHASES;
    default:
      return CATEGORY_A_PHASES;
  }
}
