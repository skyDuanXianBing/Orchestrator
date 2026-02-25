// ============================================
// core/prompt-builder.ts — 子代理 prompt 模板构建
// ============================================

import type {
  AgentName,
  PhaseDefinition,
  PipelineState,
  BlackboardJson,
} from "@orchestrator/shared";

/** 9 要素 prompt 构建参数 */
export interface PromptBuildParams {
  agentName: AgentName;
  phase: PhaseDefinition;
  state: Readonly<PipelineState>;
  blackboard: BlackboardJson;
  previousPhaseSummary: string | null;
}

/**
 * 子代理 prompt 模板构建器
 * 确保每次调用子代理都包含完整的 9 要素上下文
 */
export class PromptBuilder {
  /**
   * 构建完整的 9 要素 prompt
   *
   * 9 要素：
   * 1. 角色定义
   * 2. 任务 ID
   * 3. 用户需求
   * 4. 当前阶段信息
   * 5. 门禁条件
   * 6. 项目路径
   * 7. 文档路径
   * 8. 上一阶段摘要
   * 9. 输出格式要求
   */
  build(params: PromptBuildParams): string {
    const { agentName, phase, state, previousPhaseSummary } = params;

    const lines: string[] = [
      `## 角色`,
      `你是 ${agentName} 子代理，负责执行流水线的 ${phase.description}。`,
      ``,
      `## 任务信息`,
      `- 任务 ID: ${state.taskId}`,
      `- 分类: ${state.category}`,
      `- 模式: ${state.mode}`,
      ``,
      `## 用户需求`,
      state.userRequirement,
      ``,
      `## 当前阶段`,
      `- 阶段 ID: ${phase.phaseId}`,
      `- 描述: ${phase.description}`,
      `- 门禁条件: ${phase.gateCondition}`,
      ``,
      `## 项目路径`,
      state.projectPath,
      ``,
      `## 文档路径`,
      state.docPath,
      ``,
    ];

    if (previousPhaseSummary) {
      lines.push(`## 上一阶段摘要`);
      lines.push(previousPhaseSummary);
      lines.push(``);
    }

    lines.push(`## 输出格式要求`);
    lines.push(`你必须以 JSON 格式返回结果，包含以下字段：`);
    lines.push(`- status: "SUCCESS" | "FAILED" | "PARTIAL"`);
    lines.push(`- summary: 简要描述完成了什么（最多 3 句话）`);
    lines.push(`- changed_files: 创建/修改/删除的文件路径列表`);
    lines.push(`- commands_executed: 执行的终端命令列表`);
    lines.push(`- artifact_pointers: 产出物文件路径列表`);
    lines.push(`- error_summary: 如果失败，描述错误详情`);
    lines.push(`- next_suggestion: 建议的下一步操作`);

    return lines.join("\n");
  }

  /** 构建修订 prompt（Phase 0R 用户要求修改后） */
  buildRevisionPrompt(
    userFeedback: string,
    docPath: string,
    taskId: string,
  ): string {
    return [
      `## 修订请求`,
      `任务 ID: ${taskId}`,
      ``,
      `用户对需求文档提出了以下修改意见：`,
      ``,
      userFeedback,
      ``,
      `请根据以上意见修订 ${docPath} 下的需求文档。`,
      `修订完成后，以相同的 JSON 格式返回结果。`,
    ].join("\n");
  }
}
