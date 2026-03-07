import { describe, expect, it } from "vitest";
import { Category, Mode, PhaseType } from "@orchestrator/shared";
import type { PhaseRecord } from "@orchestrator/shared";
import { GateVerifier } from "../src/core/gate-verifier.js";

function createPhaseRecord(partial?: Partial<PhaseRecord>): PhaseRecord {
  return {
    type: "AGENT_GATE",
    agent: "impl_green_coder",
    status: "SUCCESS",
    retry_count: 0,
    started_at: "2026-01-01T00:00:00.000Z",
    finished_at: "2026-01-01T00:00:01.000Z",
    session_id: "session_1",
    task_id: "task_1",
    changed_files: ["src/a.ts"],
    commands_executed: ["pnpm test"],
    artifact_pointers: ["logs/test.log"],
    error_summary: null,
    summary: "done",
    ...partial,
  };
}

describe("GateVerifier", () => {
  it("should pass for approved human review", () => {
    const verifier = new GateVerifier();
    const record = createPhaseRecord({ status: "APPROVED_BY_HUMAN" });

    const result = verifier.verify(record, PhaseType.HUMAN_REVIEW);
    expect(result.passed).toBe(true);
  });

  it("should pass for valid agent gate", () => {
    const verifier = new GateVerifier();
    const record = createPhaseRecord();

    const result = verifier.verify(record, PhaseType.AGENT_GATE);
    expect(result.passed).toBe(true);
  });

  it("should fail when no artifacts and no changed files", () => {
    const verifier = new GateVerifier();
    const record = createPhaseRecord({ changed_files: [], artifact_pointers: [] });

    const result = verifier.verify(record, PhaseType.AGENT_GATE);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("缺少产出物或变更文件记录");
  });

  it("should pass without artifacts for MINI mode", () => {
    const verifier = new GateVerifier();
    const record = createPhaseRecord({ changed_files: [], artifact_pointers: [] });

    const result = verifier.verify(record, PhaseType.AGENT_GATE, { mode: Mode.MINI });
    expect(result.passed).toBe(true);
  });

  it("should pass without artifacts for READ category", () => {
    const verifier = new GateVerifier();
    const record = createPhaseRecord({ changed_files: [], artifact_pointers: [] });

    const result = verifier.verify(record, PhaseType.AGENT_GATE, { category: Category.READ });
    expect(result.passed).toBe(true);
  });
});
