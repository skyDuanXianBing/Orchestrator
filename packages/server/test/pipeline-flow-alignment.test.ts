import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  Category,
  Mode,
  PhaseType,
} from "@orchestrator/shared";
import { BlackboardManager } from "../src/core/blackboard.js";
import { PipelineStateMachine } from "../src/core/state-machine.js";

const tempDirs: string[] = [];

function createTempProjectDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrator-flow-test-"));
  tempDirs.push(dir);
  return dir;
}

function createMachine(category: Category, mode: Mode): PipelineStateMachine {
  const projectPath = createTempProjectDir();
  const blackboard = new BlackboardManager("task_flow_alignment", projectPath);

  return new PipelineStateMachine(
    "task_flow_alignment",
    category,
    mode,
    "对齐 agents 主流程",
    projectPath,
    blackboard,
  );
}

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("Pipeline flow alignment with agents/main.md", () => {
  it("should expose MINI in Mode enum for API/type boundary", () => {
    expect(Object.values(Mode)).toContain("MINI");
  });

  it("should start Category A base flow with tech_scout", () => {
    const machine = createMachine(Category.MODIFY, Mode.FAST);
    const phases = machine.getPhaseDefinitions();

    expect(phases[0]?.agent).toBe("tech_scout");
  });

  it("should start Category D base flow with tech_scout", () => {
    const machine = createMachine(Category.READ, Mode.FAST);
    const phases = machine.getPhaseDefinitions();

    expect(phases[0]?.agent).toBe("tech_scout");
  });

  it("should use MINI override for Category D: only tech_scout then done", () => {
    const machine = createMachine(Category.READ, "MINI" as Mode);
    const phases = machine.getPhaseDefinitions();

    expect(phases).toHaveLength(1);
    expect(phases[0]?.type).toBe(PhaseType.AGENT_GATE);
    expect(phases[0]?.agent).toBe("tech_scout");
  });

  it("should use MINI override for Category A/B/C minimal flow", () => {
    const categories = [Category.MODIFY, Category.ADD, Category.DELETE] as const;

    for (const category of categories) {
      const machine = createMachine(category, "MINI" as Mode);
      const phases = machine.getPhaseDefinitions();
      const agentChain = phases
        .filter((phase) => phase.type === PhaseType.AGENT_GATE)
        .map((phase) => phase.agent);
      const humanReviewPhases = phases.filter((phase) => phase.type === PhaseType.HUMAN_REVIEW);

      expect([3, 4]).toContain(phases.length);
      expect(humanReviewPhases.length).toBeLessThanOrEqual(1);
      expect(agentChain).toEqual([
        "tech_scout",
        "impl_green_coder",
        "quality_assurance",
      ]);
    }
  });
});
