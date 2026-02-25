import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  Category,
  Mode,
  PhaseStatus,
} from "@orchestrator/shared";
import { BlackboardManager } from "../src/core/blackboard.js";
import { PipelineStateMachine } from "../src/core/state-machine.js";

const tempDirs: string[] = [];

function createTempProjectDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrator-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("PipelineStateMachine", () => {
  it("should initialize and persist state updates to blackboard", () => {
    const projectPath = createTempProjectDir();
    const blackboard = new BlackboardManager("task_1", projectPath);

    const machine = new PipelineStateMachine(
      "task_1",
      Category.MODIFY,
      Mode.FAST,
      "修复导出逻辑",
      projectPath,
      blackboard,
    );

    blackboard.initialize(machine.getState());

    const current = machine.getCurrentPhase();
    expect(current?.phaseId).toBe("phase_0");

    machine.updatePhase("phase_0", {
      status: PhaseStatus.SUCCESS,
      finishedAt: "2026-01-01T00:00:02.000Z",
      summary: "phase 0 done",
      artifacts: ["doc/spec.md"],
      changedFiles: ["doc/spec.md"],
    });

    machine.advance();

    const persisted = blackboard.read();
    expect(persisted.phases.phase_0.status).toBe(PhaseStatus.SUCCESS);
    expect(persisted.phases.phase_0.summary).toBe("phase 0 done");
    expect(machine.getCurrentPhaseIndex()).toBe(1);
  });
});
