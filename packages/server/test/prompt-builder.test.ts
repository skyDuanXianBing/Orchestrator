import { describe, expect, it } from "vitest";
import {
  AgentName,
  Category,
  Mode,
  PhaseStatus,
  PhaseType,
  type BlackboardJson,
  type PhaseDefinition,
  type PipelineState,
} from "@orchestrator/shared";
import { PromptBuilder } from "../src/core/prompt-builder.js";

const phase: PhaseDefinition = {
  phaseId: "phase_2",
  type: PhaseType.AGENT_GATE,
  agent: AgentName.IMPL_GREEN_CODER,
  description: "编写实现代码",
  gateCondition: "实现代码已编写",
};

const state: PipelineState = {
  taskId: "task_1",
  category: Category.ADD,
  mode: Mode.BALANCED,
  currentPhaseIndex: 2,
  phases: {
    phase_2: {
      phaseType: PhaseType.AGENT_GATE,
      agent: AgentName.IMPL_GREEN_CODER,
      status: PhaseStatus.PENDING,
      retryCount: 0,
      startedAt: null,
      finishedAt: null,
      sessionId: null,
      taskId: null,
      artifacts: [],
      changedFiles: [],
      commandsExecuted: [],
      errorSummary: null,
      summary: null,
    },
  },
  docPath: "doc/req/",
  projectPath: "/tmp/project",
  userRequirement: "实现导出功能",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const blackboard: BlackboardJson = {
  task_id: "task_1",
  category: Category.ADD,
  mode: Mode.BALANCED,
  user_requirement: "实现导出功能",
  doc_path: "doc/req/",
  project_path: "/tmp/project",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  global_context: null,
  phases: {},
};

describe("PromptBuilder", () => {
  it("should include core sections and JSON output constraints", () => {
    const builder = new PromptBuilder();
    const prompt = builder.build({
      agentName: AgentName.IMPL_GREEN_CODER,
      phase,
      state,
      blackboard,
      previousPhaseSummary: "测试已失败，进入实现阶段",
    });

    expect(prompt).toContain("## 角色");
    expect(prompt).toContain("## 用户需求");
    expect(prompt).toContain("## 输出格式要求");
    expect(prompt).toContain("status: \"SUCCESS\" | \"FAILED\" | \"PARTIAL\"");
  });
});
