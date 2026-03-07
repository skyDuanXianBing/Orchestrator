import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AgentName,
  Category,
  Mode,
  PhaseStatus,
  PhaseType,
  PipelineStatus,
  SSEEventType,
  type PhaseDefinition,
  type PipelineState,
  type ReviewRequest,
  type SSEEvent,
} from "@orchestrator/shared";
import { PipelineRunner } from "../src/pipeline/runner.js";
import { EventBus } from "../src/utils/event-bus.js";
import { Logger } from "../src/utils/logger.js";
import type { BlackboardManager } from "../src/core/blackboard.js";
import type { CircuitBreaker, CircuitBreakerResult } from "../src/core/circuit-breaker.js";
import type { GateVerifier } from "../src/core/gate-verifier.js";
import type { PipelineStateMachine } from "../src/core/state-machine.js";

type RecommendedAction =
  | "PASS_WITH_WARN"
  | "REQUEST_MORE_EVIDENCE"
  | "RETRY_SAME_AGENT"
  | "SWITCH_AGENT"
  | "BLOCK";

interface ArbitrationDecisionStub {
  recommended_action: RecommendedAction;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  confidence: number;
  reason_code: string;
  reason_params?: Record<string, string | number | boolean>;
  uncertain?: boolean;
}

interface RunnerHarness {
  runner: PipelineRunner;
  phase: PhaseDefinition;
  state: PipelineState;
  events: SSEEvent[];
  pipelineStatusState: { current: PipelineStatus };
  getClientMock: ReturnType<typeof vi.fn>;
  llmPromptMock: ReturnType<typeof vi.fn>;
}

const INITIAL_ARBITRATION_MODE = process.env.ARBITRATION_MODE;

function buildDecision(
  action: RecommendedAction,
  overrides?: Partial<ArbitrationDecisionStub>,
): ArbitrationDecisionStub {
  return {
    recommended_action: action,
    risk_level: "LOW",
    confidence: 0.95,
    reason_code: `ARB_${action}`,
    reason_params: {
      phaseId: "phase_1",
    },
    ...overrides,
  };
}

function createHarness(retryResult?: CircuitBreakerResult): RunnerHarness {
  const phase: PhaseDefinition = {
    phaseId: "phase_1",
    type: PhaseType.AGENT_GATE,
    agent: AgentName.IMPL_GREEN_CODER,
    description: "Failure arbitration red test",
    gateCondition: "failure should be arbitrated",
  };

  const now = "2026-03-03T00:00:00.000Z";
  const state: PipelineState = {
    taskId: "task_arbitration_red",
    category: Category.MODIFY,
    mode: Mode.FAST,
    currentPhaseIndex: 0,
    phases: {
      [phase.phaseId]: {
        phaseType: PhaseType.AGENT_GATE,
        agent: AgentName.IMPL_GREEN_CODER,
        status: PhaseStatus.IN_PROGRESS,
        retryCount: 0,
        startedAt: now,
        finishedAt: null,
        sessionId: "session_1",
        taskId: "agent_task_1",
        artifacts: [],
        changedFiles: [],
        commandsExecuted: [],
        readFiles: [],
        operations: [],
        operationsSeq: 0,
        errorSummary: null,
        summary: null,
      },
    },
    docPath: "doc/失败仲裁与人工放行/",
    projectPath: ".",
    userRequirement: "任意失败触发仲裁",
    createdAt: now,
    updatedAt: now,
  };

  const stateMachineDouble = {
    getState: () => state,
    updatePhase: (phaseId: string, update: Record<string, unknown>) => {
      const current = state.phases[phaseId];
      state.phases[phaseId] = {
        ...current,
        ...update,
      };
      state.updatedAt = "2026-03-03T00:00:01.000Z";
    },
  } as unknown as PipelineStateMachine;

  const breakerResult = retryResult ?? {
    shouldRetry: false,
    currentCount: 3,
    maxCount: 3,
    action: "STOP_AND_REPORT",
  };

  const circuitBreakerDouble = {
    recordFailure: vi.fn().mockReturnValue(breakerResult),
    reset: vi.fn(),
    getRetryCount: vi.fn().mockReturnValue(0),
    resetAll: vi.fn(),
  } as unknown as CircuitBreaker;

  const eventBus = new EventBus();
  const events: SSEEvent[] = [];
  eventBus.subscribe((event) => {
    events.push(event);
  });

  const pipelineStatusState = {
    current: PipelineStatus.RUNNING,
  };

  const llmPromptMock = vi.fn();
  const getClientMock = vi.fn().mockResolvedValue({
    session: {
      prompt: llmPromptMock,
    },
  });

  const runner = new PipelineRunner(
    stateMachineDouble,
    {} as GateVerifier,
    circuitBreakerDouble,
    eventBus,
    new Logger(),
    {
      taskId: state.taskId,
      blackboard: {
        read: vi.fn(),
      } as unknown as BlackboardManager,
      getPipelineStatus: () => pipelineStatusState.current,
      setPipelineStatus: (status: PipelineStatus) => {
        pipelineStatusState.current = status;
      },
      waitForReview: async (): Promise<ReviewRequest> => ({ action: "approve" }),
      getClient: getClientMock,
    },
  );

  return {
    runner,
    phase,
    state,
    events,
    pipelineStatusState,
    getClientMock,
    llmPromptMock,
  };
}

function buildLlmJsonDecision(
  action: RecommendedAction,
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    decision_id: "llm-decision-1",
    phase_id: "phase_1",
    recommended_action: action,
    risk_level: "LOW",
    confidence: 0.91,
    reason_code: "ARB_LLM_DEFAULT",
    reason_params: {
      phase: "phase_1",
      source: "llm",
    },
    uncertain: false,
    failure_class: "LLM_CLASSIFICATION",
    summary: "llm arbitration decision",
    recommended_agent: null,
    evidence_request: null,
    ...overrides,
  };
}

function mockLlmPromptWithText(harness: RunnerHarness, text: string): void {
  harness.llmPromptMock.mockResolvedValue({
    error: null,
    data: {
      info: {
        id: "arb_task_1",
        error: null,
      },
      parts: [
        {
          type: "text",
          text,
        },
      ],
    },
  });
}

function findEvent(events: SSEEvent[], type: SSEEventType): SSEEvent | undefined {
  return events.find((event) => event.type === type);
}

async function invokeFailure(
  runner: PipelineRunner,
  phase: PhaseDefinition,
  reason = "gate_failed",
  details = "missing evidence",
): Promise<void> {
  const runnerWithPrivate = runner as unknown as {
    handleAgentFailure: (
      phaseDef: PhaseDefinition,
      failureReason: string,
      failureDetails: string | null,
    ) => Promise<void>;
  };

  await runnerWithPrivate.handleAgentFailure(phase, reason, details);
}

describe("PipelineRunner failure arbitration (red)", () => {
  beforeEach(() => {
    delete process.env.ARBITRATION_MODE;
  });

  afterEach(() => {
    if (typeof INITIAL_ARBITRATION_MODE === "undefined") {
      delete process.env.ARBITRATION_MODE;
    } else {
      process.env.ARBITRATION_MODE = INITIAL_ARBITRATION_MODE;
    }

    vi.restoreAllMocks();
  });

  it("should trigger arbitration before permanent pipeline failure", async () => {
    const harness = createHarness();
    const invokeFailureArbitration = vi.fn().mockResolvedValue(buildDecision("BLOCK"));

    (harness.runner as unknown as Record<string, unknown>).invokeFailureArbitration =
      invokeFailureArbitration;

    await expect(invokeFailure(harness.runner, harness.phase)).rejects.toThrow(
      /failed permanently/i,
    );

    expect(invokeFailureArbitration).toHaveBeenCalledTimes(1);

    const eventTypes = harness.events.map((event) => String(event.type));
    expect(eventTypes).toContain("arbitration_started");
    expect(eventTypes).toContain("arbitration_completed");
    expect(eventTypes.indexOf("arbitration_started")).toBeLessThan(
      eventTypes.indexOf("pipeline_failed"),
    );
  });

  it.each([
    "PASS_WITH_WARN",
    "REQUEST_MORE_EVIDENCE",
    "RETRY_SAME_AGENT",
    "SWITCH_AGENT",
    "BLOCK",
  ] as const)("should follow arbitration decision: %s", async (action) => {
    const harness = createHarness();
    const decision = buildDecision(action, {
      reason_code: `ARB_DECISION_${action}`,
    });
    const invokeFailureArbitration = vi.fn().mockResolvedValue(decision);

    (harness.runner as unknown as Record<string, unknown>).invokeFailureArbitration =
      invokeFailureArbitration;

    if (action === "BLOCK") {
      await expect(invokeFailure(harness.runner, harness.phase)).rejects.toThrow(
        /ARB_DECISION_BLOCK/i,
      );
    } else {
      await expect(invokeFailure(harness.runner, harness.phase)).resolves.toBeUndefined();
    }

    expect(invokeFailureArbitration).toHaveBeenCalledTimes(1);

    const autoActionEvent = harness.events.find((event) => String(event.type) === "arbitration_auto_action_applied");
    expect(autoActionEvent?.data).toMatchObject({
      recommended_action: action,
      reason_code: `ARB_DECISION_${action}`,
    });
  });

  it("should pause for human review when risk is HIGH", async () => {
    const harness = createHarness();
    const invokeFailureArbitration = vi.fn().mockResolvedValue(buildDecision("SWITCH_AGENT", {
      risk_level: "HIGH",
      confidence: 0.93,
      reason_code: "ARB_HIGH_RISK_SWITCH",
    }));

    (harness.runner as unknown as Record<string, unknown>).invokeFailureArbitration =
      invokeFailureArbitration;

    await expect(invokeFailure(harness.runner, harness.phase)).resolves.toBeUndefined();

    expect(harness.pipelineStatusState.current).toBe(PipelineStatus.PAUSED_FOR_REVIEW);

    const reviewEvent = harness.events.find((event) => String(event.type) === "human_review_required");
    expect(reviewEvent?.data).toMatchObject({
      phaseId: harness.phase.phaseId,
      code: "ARB_HIGH_RISK_SWITCH",
    });
  });

  it("should pause for human review when arbitration is uncertain", async () => {
    const harness = createHarness();
    const invokeFailureArbitration = vi.fn().mockResolvedValue(buildDecision("REQUEST_MORE_EVIDENCE", {
      risk_level: "MEDIUM",
      confidence: 0.82,
      uncertain: true,
      reason_code: "ARB_UNCERTAIN_MORE_EVIDENCE",
    }));

    (harness.runner as unknown as Record<string, unknown>).invokeFailureArbitration =
      invokeFailureArbitration;

    await expect(invokeFailure(harness.runner, harness.phase)).resolves.toBeUndefined();
    expect(harness.pipelineStatusState.current).toBe(PipelineStatus.PAUSED_FOR_REVIEW);
  });

  it("should expose i18n-ready server contract with stable code and params", async () => {
    const harness = createHarness();
    const invokeFailureArbitration = vi.fn().mockResolvedValue(buildDecision("BLOCK", {
      risk_level: "HIGH",
      confidence: 0.99,
      reason_code: "ARB_POLICY_BLOCKED",
      reason_params: {
        failure_class: "STRUCTURED_PARSE_ERROR",
        phase: harness.phase.phaseId,
      },
    }));

    (harness.runner as unknown as Record<string, unknown>).invokeFailureArbitration =
      invokeFailureArbitration;

    await expect(invokeFailure(harness.runner, harness.phase)).rejects.toThrow();

    const failedEvent = harness.events.find((event) => String(event.type) === "pipeline_failed");
    expect(failedEvent?.data).toMatchObject({
      code: "ARB_POLICY_BLOCKED",
      params: {
        failure_class: "STRUCTURED_PARSE_ERROR",
        phase: harness.phase.phaseId,
      },
    });

    expect(failedEvent?.data).not.toHaveProperty("reason");
  });

  it("should default to hybrid and attempt LLM first when ARBITRATION_MODE is unset", async () => {
    const harness = createHarness();
    mockLlmPromptWithText(
      harness,
      JSON.stringify(buildLlmJsonDecision("PASS_WITH_WARN", {
        reason_code: "ARB_LLM_DEFAULT_HYBRID",
      })),
    );

    await expect(
      invokeFailure(harness.runner, harness.phase, "random_failure", "llm should decide first"),
    ).resolves.toBeUndefined();

    expect(harness.getClientMock).toHaveBeenCalledTimes(1);
    expect(harness.llmPromptMock).toHaveBeenCalledTimes(1);

    const completedEvent = findEvent(harness.events, SSEEventType.ARBITRATION_COMPLETED);
    expect(completedEvent?.data).toMatchObject({
      code: "ARB_LLM_DEFAULT_HYBRID",
      params: {
        source: "llm",
      },
    });
  });

  it.each([
    {
      label: "llm_error",
      setup: (harness: RunnerHarness) => {
        harness.llmPromptMock.mockRejectedValue(new Error("llm sdk error"));
      },
    },
    {
      label: "llm_timeout",
      setup: (harness: RunnerHarness) => {
        harness.llmPromptMock.mockRejectedValue(new Error("timeout after 5000ms"));
      },
    },
    {
      label: "llm_non_json",
      setup: (harness: RunnerHarness) => {
        mockLlmPromptWithText(harness, "not a json payload");
      },
    },
  ])("hybrid should fallback to rule arbitrator when $label", async ({ setup }) => {
    process.env.ARBITRATION_MODE = "hybrid";

    const harness = createHarness();
    setup(harness);

    await expect(
      invokeFailure(harness.runner, harness.phase, "gate_failed", "missing evidence"),
    ).resolves.toBeUndefined();

    expect(harness.llmPromptMock).toHaveBeenCalledTimes(1);

    const fallbackLogEvent = harness.events.find((event) => {
      return event.type === SSEEventType.LOG_MESSAGE && event.data.code === "ARB_LLM_FALLBACK_RULE";
    });
    expect(fallbackLogEvent?.data).toEqual(expect.objectContaining({
      code: "ARB_LLM_FALLBACK_RULE",
      params: expect.any(Object),
    }));

    const completedEvent = findEvent(harness.events, SSEEventType.ARBITRATION_COMPLETED);
    expect(completedEvent?.data).toEqual(expect.objectContaining({
      recommended_action: "REQUEST_MORE_EVIDENCE",
      code: expect.any(String),
      params: expect.any(Object),
    }));

    const emittedTypes = new Set(harness.events.map((event) => event.type));
    expect(emittedTypes.has(SSEEventType.ARBITRATION_STARTED)).toBe(true);
    expect(emittedTypes.has(SSEEventType.ARBITRATION_COMPLETED)).toBe(true);
    expect(emittedTypes.has(SSEEventType.ARBITRATION_AUTO_ACTION_APPLIED)).toBe(true);
  });

  it.each([
    {
      label: "risk_high",
      decisionOverrides: {
        risk_level: "HIGH",
        uncertain: false,
        reason_code: "ARB_LLM_HIGH_RISK",
      },
    },
    {
      label: "uncertain_true",
      decisionOverrides: {
        risk_level: "LOW",
        uncertain: true,
        reason_code: "ARB_LLM_UNCERTAIN",
      },
    },
  ])("llm result should pause for human review when $label", async ({ decisionOverrides }) => {
    process.env.ARBITRATION_MODE = "llm";

    const harness = createHarness();
    mockLlmPromptWithText(
      harness,
      JSON.stringify(buildLlmJsonDecision("PASS_WITH_WARN", decisionOverrides)),
    );

    await expect(
      invokeFailure(harness.runner, harness.phase, "random_failure", "needs llm arbitration"),
    ).resolves.toBeUndefined();

    expect(harness.llmPromptMock).toHaveBeenCalledTimes(1);
    expect(harness.pipelineStatusState.current).toBe(PipelineStatus.PAUSED_FOR_REVIEW);

    const reviewEvent = findEvent(harness.events, SSEEventType.HUMAN_REVIEW_REQUIRED);
    expect(reviewEvent?.data).toEqual(expect.objectContaining({
      code: expect.any(String),
      params: expect.any(Object),
    }));
  });

  it("should keep switch-agent allowlist enforced for LLM recommendations", async () => {
    process.env.ARBITRATION_MODE = "llm";

    const harness = createHarness();
    mockLlmPromptWithText(
      harness,
      JSON.stringify(buildLlmJsonDecision("SWITCH_AGENT", {
        reason_code: "ARB_LLM_SWITCH_DISALLOWED",
        recommended_agent: AgentName.FAILURE_ARBITRATOR,
      })),
    );

    await expect(
      invokeFailure(harness.runner, harness.phase, "random_failure", "switch candidate from llm"),
    ).resolves.toBeUndefined();

    expect(harness.llmPromptMock).toHaveBeenCalledTimes(1);
    expect(harness.state.phases[harness.phase.phaseId]?.agent).toBe(AgentName.IMPL_GREEN_CODER);

    const switchAppliedLog = harness.events.find((event) => {
      return event.type === SSEEventType.LOG_MESSAGE && event.data.code === "ARB_SWITCH_AGENT_APPLIED";
    });
    expect(switchAppliedLog).toBeUndefined();

    const actionEvent = findEvent(harness.events, SSEEventType.ARBITRATION_AUTO_ACTION_APPLIED);
    expect(actionEvent?.data).toEqual(expect.objectContaining({
      recommended_action: "SWITCH_AGENT",
      code: "ARB_LLM_SWITCH_DISALLOWED",
      params: expect.any(Object),
    }));
  });
});
