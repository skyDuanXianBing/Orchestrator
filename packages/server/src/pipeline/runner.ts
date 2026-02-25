// ============================================
// pipeline/runner.ts - 流水线执行器
// ============================================

import type { OpencodeClient, Part, Event as OpencodeEvent } from "@opencode-ai/sdk";
import type {
  BlackboardJson,
  OperationTimelineEntry,
  PhaseDefinition,
  ReviewRequest,
} from "@orchestrator/shared";
import {
  PipelineStatus,
  PhaseStatus,
  PhaseType,
  SSEEventType,
  parseAgentResult,
} from "@orchestrator/shared";
import type { PipelineStateMachine } from "../core/state-machine.js";
import type { GateVerifier } from "../core/gate-verifier.js";
import type { CircuitBreaker } from "../core/circuit-breaker.js";
import type { BlackboardManager } from "../core/blackboard.js";
import { PromptBuilder } from "../core/prompt-builder.js";
import type { EventBus } from "../utils/event-bus.js";
import type { Logger } from "../utils/logger.js";

const MAX_OPERATION_TIMELINE_ENTRIES = 500;

interface OperationDraft {
  dedupeKey: string;
  opType: string;
  state: OperationTimelineEntry["state"];
  label: string;
  target?: OperationTimelineEntry["target"];
  meta?: OperationTimelineEntry["meta"];
  redaction?: OperationTimelineEntry["redaction"];
}

interface RedactionResult {
  value: string;
  rules: string[];
  replacedCount: number;
}

export interface PipelineRunnerBindings {
  taskId: string;
  blackboard: BlackboardManager;
  getPipelineStatus: () => PipelineStatus;
  setPipelineStatus: (status: PipelineStatus) => void;
  waitForReview: () => Promise<ReviewRequest>;
  getClient: (projectPath: string) => Promise<OpencodeClient>;
}

export class PipelineRunner {
  private readonly promptBuilder = new PromptBuilder();
  private readonly revisionFeedbackByPhase = new Map<string, string>();
  private client: OpencodeClient | null = null;
  private activeSessionId: string | null = null;
  private aborted = false;

  constructor(
    private stateMachine: PipelineStateMachine,
    private gateVerifier: GateVerifier,
    private circuitBreaker: CircuitBreaker,
    private eventBus: EventBus,
    private logger: Logger,
    private bindings: PipelineRunnerBindings,
  ) {}

  async run(): Promise<void> {
    this.emit(SSEEventType.PIPELINE_STARTED, {
      phaseIndex: this.stateMachine.getCurrentPhaseIndex(),
      totalPhases: this.stateMachine.getTotalPhases(),
    });

    while (!this.stateMachine.isComplete()) {
      if (this.shouldStop()) {
        this.emit(SSEEventType.PIPELINE_ABORTED, { reason: "aborted" });
        return;
      }

      const phase = this.stateMachine.getCurrentPhase();
      if (!phase) {
        break;
      }

      this.logger.printPipelineStatus(
        this.bindings.taskId,
        phase.phaseId,
        this.stateMachine.getCurrentPhaseIndex(),
        this.stateMachine.getTotalPhases(),
        phase.description,
      );

      if (phase.type === PhaseType.HUMAN_REVIEW) {
        await this.runHumanReviewPhase(phase);
      } else {
        await this.runAgentPhase(phase);
      }
    }

    if (this.shouldStop()) {
      this.emit(SSEEventType.PIPELINE_ABORTED, { reason: "aborted" });
      return;
    }

    this.emit(SSEEventType.PIPELINE_COMPLETED, {
      totalPhases: this.stateMachine.getTotalPhases(),
    });
  }

  async abort(): Promise<void> {
    this.aborted = true;

    if (!this.client || !this.activeSessionId) {
      return;
    }

    try {
      await this.client.session.abort({
        path: { id: this.activeSessionId },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown abort error";
      this.logger.warn("Abort session failed", message);
    }
  }

  private async runHumanReviewPhase(phase: PhaseDefinition): Promise<void> {
    const startedAt = new Date().toISOString();

    this.stateMachine.updatePhase(phase.phaseId, {
      status: PhaseStatus.IN_PROGRESS,
      startedAt,
      finishedAt: null,
      errorSummary: null,
      summary: null,
    });

    this.emit(SSEEventType.PHASE_STARTED, {
      phaseId: phase.phaseId,
      agent: null,
      description: phase.description,
      phaseIndex: this.stateMachine.getCurrentPhaseIndex(),
      totalPhases: this.stateMachine.getTotalPhases(),
    });

    this.bindings.setPipelineStatus(PipelineStatus.PAUSED_FOR_REVIEW);

    const state = this.stateMachine.getState();
    this.emit(SSEEventType.HUMAN_REVIEW_REQUIRED, {
      phaseId: phase.phaseId,
      docPath: state.docPath,
      docContent: null,
    });

    const review = await this.bindings.waitForReview();

    if (this.shouldStop()) {
      return;
    }

    this.bindings.setPipelineStatus(PipelineStatus.RUNNING);

    if (review.action === "approve") {
      const finishedAt = new Date().toISOString();
      const summary = review.comment?.trim()
        ? `用户已批准，备注: ${review.comment.trim()}`
        : "用户已批准";

      this.stateMachine.updatePhase(phase.phaseId, {
        status: PhaseStatus.APPROVED_BY_HUMAN,
        finishedAt,
        summary,
      });

      this.emit(SSEEventType.HUMAN_REVIEW_COMPLETED, {
        phaseId: phase.phaseId,
        action: review.action,
        comment: review.comment ?? null,
      });

      this.emit(SSEEventType.PHASE_COMPLETED, {
        phaseId: phase.phaseId,
        agent: null,
        summary,
        artifacts: [],
      });

      this.stateMachine.advance();
      return;
    }

    this.resetForRevision(phase.phaseId, review.comment ?? null);

    this.emit(SSEEventType.HUMAN_REVIEW_COMPLETED, {
      phaseId: phase.phaseId,
      action: review.action,
      comment: review.comment ?? null,
    });

    this.emit(SSEEventType.LOG_MESSAGE, {
      level: "info",
      message: "用户要求修订，回退到上一阶段重跑",
      agent: null,
      phaseId: phase.phaseId,
    });
  }

  private resetForRevision(reviewPhaseId: string, reviewComment: string | null): void {
    const currentIndex = this.stateMachine.getCurrentPhaseIndex();
    const phaseDefs = this.stateMachine.getPhaseDefinitions();
    const previousPhase = currentIndex > 0 ? phaseDefs[currentIndex - 1] : null;

    this.stateMachine.updatePhase(reviewPhaseId, {
      status: PhaseStatus.PENDING,
      startedAt: null,
      finishedAt: null,
      sessionId: null,
      taskId: null,
      artifacts: [],
      changedFiles: [],
      commandsExecuted: [],
      readFiles: [],
      operations: [],
      operationsSeq: 0,
      errorSummary: null,
      summary: null,
      retryCount: 0,
    });

    if (previousPhase) {
      const feedback = reviewComment?.trim();
      if (feedback) {
        this.revisionFeedbackByPhase.set(previousPhase.phaseId, feedback);
      }

      this.stateMachine.updatePhase(previousPhase.phaseId, {
        status: PhaseStatus.PENDING,
        startedAt: null,
        finishedAt: null,
        sessionId: null,
        taskId: null,
        artifacts: [],
        changedFiles: [],
        commandsExecuted: [],
        readFiles: [],
        operations: [],
        operationsSeq: 0,
        errorSummary: null,
        summary: null,
        retryCount: 0,
      });

      this.stateMachine.setCurrentPhaseIndex(currentIndex - 1);
    }
  }

  private async runAgentPhase(phase: PhaseDefinition): Promise<void> {
    if (!phase.agent) {
      throw new Error(`Phase ${phase.phaseId} agent is missing`);
    }

    const state = this.stateMachine.getState();
    const startedAt = new Date().toISOString();

    this.stateMachine.updatePhase(phase.phaseId, {
      status: PhaseStatus.IN_PROGRESS,
      startedAt,
      finishedAt: null,
      errorSummary: null,
    });

    this.emit(SSEEventType.PHASE_STARTED, {
      phaseId: phase.phaseId,
      agent: phase.agent,
      description: phase.description,
      phaseIndex: this.stateMachine.getCurrentPhaseIndex(),
      totalPhases: this.stateMachine.getTotalPhases(),
    });

    let eventStreamController: AbortController | null = null;
    let eventForwardingTask: Promise<void> | null = null;

    try {
      this.client = await this.bindings.getClient(state.projectPath);

      const createSessionResult = await this.client.session.create({
        query: { directory: state.projectPath },
        body: { title: `${state.taskId}:${phase.phaseId}` },
      });

      if (createSessionResult.error || !createSessionResult.data) {
        throw new Error("Create session failed");
      }

      const sessionId = createSessionResult.data.id;
      this.activeSessionId = sessionId;

      eventStreamController = new AbortController();
      eventForwardingTask = this.startEventForwarding(
        state.projectPath,
        sessionId,
        phase.phaseId,
        phase.agent,
        eventStreamController,
      );

      const blackboard = this.bindings.blackboard.read();
      const promptText = this.buildAgentPrompt(phase, blackboard);

      const promptResult = await this.client.session.prompt({
        query: { directory: state.projectPath },
        path: { id: sessionId },
        body: {
          agent: phase.agent,
          parts: [
            {
              type: "text",
              text: promptText,
            },
          ],
        },
      });

      if (promptResult.error || !promptResult.data) {
        throw new Error("Prompt request failed");
      }

      if (promptResult.data.info.error) {
        throw new Error(this.formatAssistantError(promptResult.data.info.error));
      }

      await this.stopEventForwarding(eventStreamController, eventForwardingTask);

      const rawText = this.extractText(promptResult.data.parts);
      const structuredResult = parseAgentResult(rawText);
      const finishedAt = new Date().toISOString();
      const status = structuredResult.status === "SUCCESS"
        ? PhaseStatus.SUCCESS
        : PhaseStatus.FAILED;
      const runtimeBeforeCompletion = this.stateMachine.getState().phases[phase.phaseId];
      const mergedArtifacts = this.mergeUniqueValues(
        runtimeBeforeCompletion?.artifacts ?? [],
        structuredResult.artifact_pointers,
      );
      const mergedChangedFiles = this.mergeUniqueValues(
        runtimeBeforeCompletion?.changedFiles ?? [],
        structuredResult.changed_files,
      );
      const redactedStructuredCommands = structuredResult.commands_executed.map((command) => {
        return this.redactSensitiveText(command).value;
      });
      const mergedCommands = this.mergeUniqueValues(
        runtimeBeforeCompletion?.commandsExecuted ?? [],
        redactedStructuredCommands,
      );

      this.stateMachine.updatePhase(phase.phaseId, {
        status,
        finishedAt,
        sessionId,
        taskId: promptResult.data.info.id,
        artifacts: mergedArtifacts,
        changedFiles: mergedChangedFiles,
        commandsExecuted: mergedCommands,
        readFiles: runtimeBeforeCompletion?.readFiles ?? [],
        operations: runtimeBeforeCompletion?.operations ?? [],
        operationsSeq: runtimeBeforeCompletion?.operationsSeq ?? 0,
        errorSummary: structuredResult.error_summary,
        summary: structuredResult.summary,
      });

      const phaseRecord = this.bindings.blackboard.read().phases[phase.phaseId];
      const gateResult = this.gateVerifier.verify(phaseRecord, phase.type);

      if (gateResult.passed) {
        this.circuitBreaker.reset(phase.agent);

        this.emit(SSEEventType.GATE_PASSED, {
          phaseId: phase.phaseId,
          reason: gateResult.reason,
        });

        this.emit(SSEEventType.PHASE_COMPLETED, {
          phaseId: phase.phaseId,
          agent: phase.agent,
          summary: structuredResult.summary,
          artifacts: structuredResult.artifact_pointers,
        });

        this.stateMachine.advance();
        return;
      }

      await this.handleAgentFailure(
        phase,
        gateResult.reason,
        structuredResult.error_summary,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown phase error";
      await this.handleAgentFailure(phase, message, message);
    } finally {
      await this.stopEventForwarding(eventStreamController, eventForwardingTask);
      this.activeSessionId = null;
    }
  }

  private async handleAgentFailure(
    phase: PhaseDefinition,
    reason: string,
    details: string | null,
  ): Promise<void> {
    if (!phase.agent) {
      throw new Error(`Phase ${phase.phaseId} agent is missing`);
    }

    const fingerprint = `${phase.phaseId}:${reason}`;
    const retryResult = this.circuitBreaker.recordFailure(phase.agent, fingerprint);
    const runtime = this.stateMachine.getState().phases[phase.phaseId];
    const finishedAt = new Date().toISOString();

    this.stateMachine.updatePhase(phase.phaseId, {
      status: PhaseStatus.FAILED,
      retryCount: retryResult.currentCount,
      finishedAt,
      errorSummary: reason,
      summary: details,
      startedAt: runtime.startedAt,
    });

    this.emit(SSEEventType.GATE_FAILED, {
      phaseId: phase.phaseId,
      reason,
    });

    this.emit(SSEEventType.PHASE_FAILED, {
      phaseId: phase.phaseId,
      agent: phase.agent,
      errorSummary: reason,
      retryCount: retryResult.currentCount,
      maxRetries: retryResult.maxCount,
      willRetry: retryResult.shouldRetry,
    });

    if (retryResult.shouldRetry) {
      this.emit(SSEEventType.LOG_MESSAGE, {
        level: "warn",
        message: `阶段 ${phase.phaseId} 失败，准备第 ${retryResult.currentCount}/${retryResult.maxCount} 次重试`,
        agent: phase.agent,
        phaseId: phase.phaseId,
      });
      return;
    }

    this.emit(SSEEventType.CIRCUIT_BREAKER_TRIGGERED, {
      phaseId: phase.phaseId,
      reason,
      retryCount: retryResult.currentCount,
      maxRetries: retryResult.maxCount,
    });

    this.emit(SSEEventType.PIPELINE_FAILED, {
      phaseId: phase.phaseId,
      reason,
    });

    throw new Error(`Phase ${phase.phaseId} failed permanently: ${reason}`);
  }

  private buildAgentPrompt(phase: PhaseDefinition, blackboard: BlackboardJson): string {
    const state = this.stateMachine.getState();
    const currentIndex = this.stateMachine.getCurrentPhaseIndex();
    const phaseDefinitions = this.stateMachine.getPhaseDefinitions();
    const previousPhase = currentIndex > 0 ? phaseDefinitions[currentIndex - 1] : null;
    const previousPhaseSummary = previousPhase
      ? state.phases[previousPhase.phaseId]?.summary ?? null
      : null;

    if (!phase.agent) {
      throw new Error(`Phase ${phase.phaseId} agent is missing`);
    }

    const basePrompt = this.promptBuilder.build({
      agentName: phase.agent,
      phase,
      state,
      blackboard,
      previousPhaseSummary,
    });

    const revisionFeedback = this.revisionFeedbackByPhase.get(phase.phaseId);
    if (!revisionFeedback) {
      return basePrompt;
    }

    this.revisionFeedbackByPhase.delete(phase.phaseId);
    const revisionPrompt = this.promptBuilder.buildRevisionPrompt(
      revisionFeedback,
      state.docPath,
      state.taskId,
    );

    return `${basePrompt}\n\n${revisionPrompt}`;
  }

  private extractText(parts: Part[]): string {
    const textList: string[] = [];

    for (const part of parts) {
      if (part.type === "text") {
        textList.push(part.text);
      }
    }

    if (textList.length === 0) {
      return "";
    }

    return textList.join("\n").trim();
  }

  private formatAssistantError(error: { name: string; data?: { message?: string } }): string {
    const detail = error.data?.message;
    if (detail) {
      return `${error.name}: ${detail}`;
    }
    return error.name;
  }

  private shouldStop(): boolean {
    return this.aborted || this.bindings.getPipelineStatus() === PipelineStatus.ABORTED;
  }

  private async stopEventForwarding(
    controller: AbortController | null,
    task: Promise<void> | null,
  ): Promise<void> {
    if (!controller || !task) {
      return;
    }

    controller.abort();
    try {
      await task;
    } catch {
      // Ignore forwarding task shutdown errors.
    }
  }

  private async startEventForwarding(
    projectPath: string,
    sessionId: string,
    phaseId: string,
    agent: string,
    controller: AbortController,
  ): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      const subscription = await this.client.event.subscribe({
        query: { directory: projectPath },
        signal: controller.signal,
      });

      for await (const event of subscription.stream) {
        if (controller.signal.aborted || this.shouldStop()) {
          break;
        }
        this.forwardSdkEvent(event, sessionId, phaseId, agent);
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      const message = error instanceof Error ? error.message : "unknown event subscribe error";
      this.emit(SSEEventType.LOG_MESSAGE, {
        level: "warn",
        message: `订阅 opencode 事件失败: ${message}`,
        agent,
        phaseId,
      });
    }
  }

  private forwardSdkEvent(
    event: OpencodeEvent,
    expectedSessionId: string,
    phaseId: string,
    agent: string,
  ): void {
    const eventSessionId = this.extractEventSessionId(event);
    if (eventSessionId && eventSessionId !== expectedSessionId) {
      return;
    }

    switch (event.type) {
      case "session.status": {
        this.emit(SSEEventType.LOG_MESSAGE, {
          level: "debug",
          message: `session 状态更新: ${event.properties.status.type}`,
          agent,
          phaseId,
        });
        break;
      }
      case "message.part.updated": {
        const part = event.properties.part;
        this.captureOperationFromPart(phaseId, agent, part);
        if (part.type === "text") {
          const preview = part.text.trim().slice(0, 120);
          if (preview.length > 0) {
            this.emit(SSEEventType.LOG_MESSAGE, {
              level: "debug",
              message: `agent 输出: ${preview}`,
              agent,
              phaseId,
            });
          }
        }
        break;
      }
      case "file.edited": {
        const filePath = event.properties.file.trim();
        this.appendChangedFile(phaseId, filePath);
        break;
      }
      case "command.executed": {
        const command = this.buildExecutedCommand(
          event.properties.name,
          event.properties.arguments,
        );
        this.appendExecutedCommand(phaseId, command);
        break;
      }
      case "session.error": {
        const name = event.properties.error?.name ?? "UnknownError";
        const detail = event.properties.error?.data?.message ?? "unknown";
        this.emit(SSEEventType.LOG_MESSAGE, {
          level: "error",
          message: `session.error: ${name} - ${detail}`,
          agent,
          phaseId,
        });
        break;
      }
      default:
        break;
    }
  }

  private captureOperationFromPart(phaseId: string, agent: string, part: Part): void {
    let draft: OperationDraft | null = null;

    if (part.type === "tool") {
      draft = this.buildToolOperationDraft(part);
    }

    if (part.type === "patch") {
      draft = this.buildPatchOperationDraft(part);
    }

    if (part.type === "file") {
      draft = this.buildFileOperationDraft(part);
    }

    if (!draft) {
      return;
    }

    this.appendOperationTimeline(phaseId, agent, draft);
  }

  private buildToolOperationDraft(part: Extract<Part, { type: "tool" }>): OperationDraft {
    const toolName = part.tool.trim();
    const normalizedToolName = toolName.toLowerCase();
    const input = this.toRecord(part.state.input);
    const metadata = this.extractToolMetadata(part.state);
    const redactionResults: RedactionResult[] = [];
    const meta: Record<string, unknown> = {};

    let state: OperationTimelineEntry["state"] = "COMPLETED";
    if (part.state.status === "pending" || part.state.status === "running") {
      state = "STARTED";
    }
    if (part.state.status === "error") {
      state = "FAILED";
    }

    const durationMs = this.extractToolDurationMs(part.state);
    if (durationMs !== null) {
      meta.duration_ms = durationMs;
    }

    if (normalizedToolName.includes("read")) {
      const rawPath = this.extractString(input, ["filePath", "filepath", "path", "file", "directory"]);
      let target: OperationTimelineEntry["target"] | undefined;
      if (rawPath) {
        const sanitizedPath = this.redactSensitiveText(rawPath);
        if (sanitizedPath.replacedCount > 0) {
          redactionResults.push(sanitizedPath);
        }
        target = { kind: "path", value: sanitizedPath.value, display: sanitizedPath.value };
      }

      const lineCount = this.extractNumber(metadata, ["line_count", "lineCount"]);
      if (lineCount !== null) {
        meta.line_count = lineCount;
      }

      const byteCount = this.extractNumber(metadata, ["byte_count", "byteCount", "bytes"]);
      if (byteCount !== null) {
        meta.byte_count = byteCount;
      }

      const entryCount = this.extractNumber(metadata, ["entry_count", "entryCount"]);
      if (entryCount !== null) {
        meta.entry_count = entryCount;
      }

      const truncated = this.extractBoolean(metadata, ["truncated"]);
      if (truncated !== null) {
        meta.truncated = truncated;
      }

      let opType = "read.file";
      let label = "Read file";
      if (rawPath && rawPath.endsWith("/")) {
        opType = "read.dir";
        label = "List directory";
      }

      return {
        dedupeKey: `tool:${part.id}:${state}`,
        opType,
        state,
        label,
        target,
        meta,
        redaction: this.buildRedactionInfo(redactionResults),
      };
    }

    if (normalizedToolName.includes("glob")) {
      const rawPattern = this.extractString(input, ["pattern"]);
      let target: OperationTimelineEntry["target"] | undefined;
      if (rawPattern) {
        const sanitizedPattern = this.redactSensitiveText(rawPattern);
        if (sanitizedPattern.replacedCount > 0) {
          redactionResults.push(sanitizedPattern);
        }
        target = {
          kind: "pattern",
          value: sanitizedPattern.value,
          display: sanitizedPattern.value,
        };
      }

      const matchCount = this.extractNumber(metadata, ["match_count", "matchCount"]);
      if (matchCount !== null) {
        meta.match_count = matchCount;
      }

      return {
        dedupeKey: `tool:${part.id}:${state}`,
        opType: "search.glob",
        state,
        label: "Glob files",
        target,
        meta,
        redaction: this.buildRedactionInfo(redactionResults),
      };
    }

    if (normalizedToolName.includes("grep")) {
      const rawPattern = this.extractString(input, ["pattern", "query"]);
      let target: OperationTimelineEntry["target"] | undefined;
      if (rawPattern) {
        const sanitizedPattern = this.redactSensitiveText(rawPattern);
        if (sanitizedPattern.replacedCount > 0) {
          redactionResults.push(sanitizedPattern);
        }
        target = {
          kind: "pattern",
          value: sanitizedPattern.value,
          display: sanitizedPattern.value,
        };
      }

      const matchCount = this.extractNumber(metadata, ["match_count", "matchCount"]);
      if (matchCount !== null) {
        meta.match_count = matchCount;
      }

      const fileCount = this.extractNumber(metadata, ["file_count", "fileCount"]);
      if (fileCount !== null) {
        meta.file_count = fileCount;
      }

      return {
        dedupeKey: `tool:${part.id}:${state}`,
        opType: "search.grep",
        state,
        label: "Search pattern",
        target,
        meta,
        redaction: this.buildRedactionInfo(redactionResults),
      };
    }

    if (normalizedToolName.includes("bash") || normalizedToolName.includes("command")) {
      const command = this.resolveToolCommand(input, toolName);
      const redactedCommand = this.redactSensitiveText(command);
      if (redactedCommand.replacedCount > 0) {
        redactionResults.push(redactedCommand);
      }

      const exitCode = this.extractNumber(metadata, ["exit_code", "exitCode", "code"]);
      if (exitCode !== null) {
        meta.exit_code = exitCode;
      }

      const cwd = this.extractString(input, ["workdir", "cwd", "directory"])
        ?? this.extractString(metadata, ["cwd", "workdir", "directory"]);
      if (cwd) {
        meta.cwd = cwd;
      }

      return {
        dedupeKey: `tool:${part.id}:${state}`,
        opType: "exec.command",
        state,
        label: "Run command",
        target: {
          kind: "command",
          value: redactedCommand.value,
          display: redactedCommand.value,
        },
        meta,
        redaction: this.buildRedactionInfo(redactionResults),
      };
    }

    if (
      normalizedToolName.includes("edit")
      || normalizedToolName.includes("write")
      || normalizedToolName.includes("patch")
    ) {
      const changedPaths = this.mergeUniqueValues(
        this.extractStringArray(input, ["changed_paths", "changedPaths", "files", "paths"]),
        this.extractStringArray(metadata, ["changed_paths", "changedPaths", "files", "paths"]),
      );

      const rawPath = this.extractString(input, ["filePath", "filepath", "path", "file"]);
      let target: OperationTimelineEntry["target"] | undefined;
      if (rawPath) {
        const sanitizedPath = this.redactSensitiveText(rawPath);
        if (sanitizedPath.replacedCount > 0) {
          redactionResults.push(sanitizedPath);
        }
        target = { kind: "path", value: sanitizedPath.value, display: sanitizedPath.value };
      }

      if (changedPaths.length > 0) {
        meta.changed_paths = changedPaths;
      }

      return {
        dedupeKey: `tool:${part.id}:${state}`,
        opType: "fs.edit",
        state,
        label: "Edit file",
        target,
        meta,
        redaction: this.buildRedactionInfo(redactionResults),
      };
    }

    if (normalizedToolName.includes("artifact")) {
      const rawPointer = this.extractString(input, ["pointer", "artifact", "path", "file", "url"]);
      let target: OperationTimelineEntry["target"] | undefined;
      if (rawPointer) {
        const sanitizedPointer = this.redactSensitiveText(rawPointer);
        if (sanitizedPointer.replacedCount > 0) {
          redactionResults.push(sanitizedPointer);
        }
        target = { kind: "artifact", value: sanitizedPointer.value, display: sanitizedPointer.value };
      }

      const kind = this.extractString(input, ["kind", "type"]);
      if (kind) {
        meta.kind = kind;
      }

      return {
        dedupeKey: `tool:${part.id}:${state}`,
        opType: "artifact.add",
        state,
        label: "Add artifact",
        target,
        meta,
        redaction: this.buildRedactionInfo(redactionResults),
      };
    }

    if (
      normalizedToolName.includes("webfetch")
      || normalizedToolName.includes("tavily")
      || normalizedToolName.includes("google_search")
    ) {
      const rawUrl = this.extractString(input, ["url"]);
      let target: OperationTimelineEntry["target"] | undefined;
      if (rawUrl) {
        const sanitizedUrl = this.redactSensitiveText(rawUrl);
        if (sanitizedUrl.replacedCount > 0) {
          redactionResults.push(sanitizedUrl);
        }
        target = { kind: "url", value: sanitizedUrl.value, display: sanitizedUrl.value };
      }

      const statusCode = this.extractNumber(metadata, ["status_code", "statusCode"]);
      if (statusCode !== null) {
        meta.status_code = statusCode;
      }

      const bytes = this.extractNumber(metadata, ["bytes", "byte_count", "byteCount"]);
      if (bytes !== null) {
        meta.bytes = bytes;
      }

      return {
        dedupeKey: `tool:${part.id}:${state}`,
        opType: "net.fetch",
        state,
        label: "Fetch URL",
        target,
        meta,
        redaction: this.buildRedactionInfo(redactionResults),
      };
    }

    if (normalizedToolName.includes("context7")) {
      const identifier = this.extractString(input, ["libraryId", "id", "query"]);
      if (identifier) {
        const redactedIdentifier = this.redactSensitiveText(identifier);
        if (redactedIdentifier.replacedCount > 0) {
          redactionResults.push(redactedIdentifier);
        }
        return {
          dedupeKey: `tool:${part.id}:${state}`,
          opType: "ai.context.query",
          state,
          label: "Query docs",
          target: {
            kind: "id",
            value: redactedIdentifier.value,
            display: redactedIdentifier.value,
          },
          meta,
          redaction: this.buildRedactionInfo(redactionResults),
        };
      }
    }

    return {
      dedupeKey: `tool:${part.id}:${state}`,
      opType: "unknown",
      state,
      label: "Operation",
      target: { kind: "id", value: toolName, display: toolName },
      meta: { ...meta, raw_type: toolName },
      redaction: this.buildRedactionInfo(redactionResults),
    };
  }

  private buildPatchOperationDraft(part: Extract<Part, { type: "patch" }>): OperationDraft {
    const redactionResults: RedactionResult[] = [];
    const changedPaths: string[] = [];

    for (const filePath of part.files) {
      const trimmed = filePath.trim();
      if (trimmed.length === 0) {
        continue;
      }

      const redacted = this.redactSensitiveText(trimmed);
      if (redacted.replacedCount > 0) {
        redactionResults.push(redacted);
      }
      this.appendUniqueValue(changedPaths, redacted.value);
    }

    const firstPath = changedPaths.length > 0 ? changedPaths[0] : null;

    let target: OperationTimelineEntry["target"];
    if (firstPath) {
      target = { kind: "path", value: firstPath, display: firstPath };
    } else {
      target = { kind: "id", value: part.id, display: part.id };
    }

    return {
      dedupeKey: `patch:${part.id}`,
      opType: "fs.edit",
      state: "COMPLETED",
      label: "Edit file",
      target,
      meta: {
        changed_paths: changedPaths,
        file_count: changedPaths.length,
      },
      redaction: this.buildRedactionInfo(redactionResults),
    };
  }

  private buildFileOperationDraft(part: Extract<Part, { type: "file" }>): OperationDraft {
    const redactionResults: RedactionResult[] = [];
    const rawTarget = part.filename
      ?? (part.source ? part.source.path : null)
      ?? part.url;

    const redactedTarget = this.redactSensitiveText(rawTarget);
    if (redactedTarget.replacedCount > 0) {
      redactionResults.push(redactedTarget);
    }

    return {
      dedupeKey: `file:${part.id}`,
      opType: "artifact.add",
      state: "COMPLETED",
      label: "Add artifact",
      target: {
        kind: "artifact",
        value: redactedTarget.value,
        display: redactedTarget.value,
      },
      meta: {
        pointer: redactedTarget.value,
        mime: part.mime,
      },
      redaction: this.buildRedactionInfo(redactionResults),
    };
  }

  private appendOperationTimeline(phaseId: string, agent: string, draft: OperationDraft): void {
    const phaseRuntime = this.stateMachine.getState().phases[phaseId];
    if (!phaseRuntime) {
      return;
    }

    const existingOperations = phaseRuntime.operations ? [...phaseRuntime.operations] : [];
    const opId = `${phaseId}:${draft.dedupeKey}`;

    for (const operation of existingOperations) {
      if (operation.op_id === opId) {
        return;
      }
    }

    const nextSeq = (phaseRuntime.operationsSeq ?? 0) + 1;
    const entry: OperationTimelineEntry = {
      op_id: opId,
      seq: nextSeq,
      ts: new Date().toISOString(),
      phase_id: phaseId,
      agent,
      op_type: draft.opType,
      state: draft.state,
      label: draft.label,
      target: draft.target,
      meta: draft.meta,
      redaction: draft.redaction,
    };

    existingOperations.push(entry);
    const operations = existingOperations.length > MAX_OPERATION_TIMELINE_ENTRIES
      ? existingOperations.slice(-MAX_OPERATION_TIMELINE_ENTRIES)
      : existingOperations;

    const changedFiles = [...phaseRuntime.changedFiles];
    const commandsExecuted = [...phaseRuntime.commandsExecuted];
    const artifacts = [...phaseRuntime.artifacts];
    const readFiles = phaseRuntime.readFiles ? [...phaseRuntime.readFiles] : [];

    this.applyOperationSummary(entry, changedFiles, commandsExecuted, artifacts, readFiles);

    this.stateMachine.updatePhase(phaseId, {
      operations,
      operationsSeq: nextSeq,
      changedFiles,
      commandsExecuted,
      artifacts,
      readFiles,
    });

    this.emit(SSEEventType.BLACKBOARD_UPDATED, {
      phaseId,
      opId: entry.op_id,
      opType: entry.op_type,
      seq: entry.seq,
    });
  }

  private applyOperationSummary(
    entry: OperationTimelineEntry,
    changedFiles: string[],
    commandsExecuted: string[],
    artifacts: string[],
    readFiles: string[],
  ): void {
    if ((entry.op_type === "read.file" || entry.op_type === "read.dir") && entry.target?.kind === "path") {
      this.appendUniqueValue(readFiles, entry.target.value);
    }

    if (entry.op_type === "exec.command") {
      const command = entry.target?.display ?? entry.target?.value ?? null;
      this.appendUniqueValue(commandsExecuted, command);
    }

    if (entry.op_type === "artifact.add") {
      const pointer = this.readMetaString(entry.meta, "pointer")
        ?? entry.target?.value
        ?? null;
      this.appendUniqueValue(artifacts, pointer);
    }

    if (entry.op_type === "fs.edit") {
      if (entry.target?.kind === "path") {
        this.appendUniqueValue(changedFiles, entry.target.value);
      }

      const changedPaths = this.readMetaStringArray(entry.meta, "changed_paths");
      for (const filePath of changedPaths) {
        this.appendUniqueValue(changedFiles, filePath);
      }
    }
  }

  private resolveToolCommand(input: Record<string, unknown>, fallbackName: string): string {
    const command = this.extractString(input, ["command", "cmd", "script"]);
    if (command) {
      return command;
    }

    const name = this.extractString(input, ["name", "tool", "program"]) ?? fallbackName;
    const args = this.extractString(input, ["arguments", "args"]) ?? "";
    const resolved = this.buildExecutedCommand(name, args);
    if (resolved) {
      return resolved;
    }

    return fallbackName;
  }

  private extractToolMetadata(
    state: Extract<Part, { type: "tool" }>["state"],
  ): Record<string, unknown> {
    if (state.status === "running" || state.status === "completed" || state.status === "error") {
      if (state.metadata) {
        return this.toRecord(state.metadata);
      }
    }
    return {};
  }

  private extractToolDurationMs(state: Extract<Part, { type: "tool" }>["state"]): number | null {
    if ((state.status === "completed" || state.status === "error") && state.time.end) {
      const duration = state.time.end - state.time.start;
      if (Number.isFinite(duration) && duration >= 0) {
        return duration;
      }
    }
    return null;
  }

  private buildRedactionInfo(results: RedactionResult[]): OperationTimelineEntry["redaction"] | undefined {
    let replacedCount = 0;
    const rules: string[] = [];

    for (const result of results) {
      replacedCount += result.replacedCount;
      for (const rule of result.rules) {
        if (!rules.includes(rule)) {
          rules.push(rule);
        }
      }
    }

    if (replacedCount === 0) {
      return undefined;
    }

    return {
      applied: true,
      rules,
      replaced_count: replacedCount,
    };
  }

  private redactSensitiveText(value: string): RedactionResult {
    let sanitized = value;
    const rules: string[] = [];
    let replacedCount = 0;

    const applyRule = (rule: string, pattern: RegExp, replacement: string): void => {
      const matches = sanitized.match(pattern);
      if (!matches || matches.length === 0) {
        return;
      }

      sanitized = sanitized.replace(pattern, replacement);
      replacedCount += matches.length;
      if (!rules.includes(rule)) {
        rules.push(rule);
      }
    };

    applyRule(
      "command.secret_flags",
      /(--(?:token|password|pass|secret|key|api-key|access-key)\s*=\s*)([^\s"']+)/gi,
      "$1[REDACTED]",
    );
    applyRule(
      "command.secret_flags",
      /(--(?:token|password|pass|secret|key|api-key|access-key)\s+)([^\s"']+)/gi,
      "$1[REDACTED]",
    );
    applyRule(
      "header.authorization",
      /(--header\s+["']?Authorization:\s*)([^\s"']+)/gi,
      "$1[REDACTED]",
    );
    applyRule(
      "env.assignments",
      /\b([A-Z_][A-Z0-9_]*(?:TOKEN|PASSWORD|PASS|SECRET|KEY|COOKIE|AUTH)[A-Z0-9_]*)=([^\s]+)/g,
      "$1=[REDACTED]",
    );
    applyRule(
      "url.query_sensitive",
      /([?&](?:token|key|sig|signature|password|secret|api[_-]?key|access[_-]?key)=)([^&#\s]+)/gi,
      "$1[REDACTED]",
    );
    applyRule(
      "token.long_string",
      /\b([A-Za-z0-9+_.=-]{32,})\b/g,
      "[REDACTED]",
    );

    return {
      value: sanitized,
      rules,
      replacedCount,
    };
  }

  private mergeUniqueValues(existing: string[], incoming: string[]): string[] {
    const merged = [...existing];
    for (const value of incoming) {
      this.appendUniqueValue(merged, value);
    }
    return merged;
  }

  private appendUniqueValue(list: string[], candidate: string | null): void {
    if (!candidate) {
      return;
    }

    const value = candidate.trim();
    if (value.length === 0) {
      return;
    }

    if (list.includes(value)) {
      return;
    }

    list.push(value);
  }

  private toRecord(input: unknown): Record<string, unknown> {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return {};
    }
    return input as Record<string, unknown>;
  }

  private extractString(source: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }
    return null;
  }

  private extractNumber(source: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }

      if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
    return null;
  }

  private extractBoolean(source: Record<string, unknown>, keys: string[]): boolean | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "boolean") {
        return value;
      }
    }
    return null;
  }

  private extractStringArray(source: Record<string, unknown>, keys: string[]): string[] {
    const result: string[] = [];

    for (const key of keys) {
      const value = source[key];
      if (!Array.isArray(value)) {
        continue;
      }

      for (const item of value) {
        if (typeof item !== "string") {
          continue;
        }

        this.appendUniqueValue(result, item);
      }
    }

    return result;
  }

  private readMetaString(meta: Record<string, unknown> | undefined, key: string): string | null {
    if (!meta) {
      return null;
    }

    const value = meta[key];
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    return trimmed;
  }

  private readMetaStringArray(meta: Record<string, unknown> | undefined, key: string): string[] {
    if (!meta) {
      return [];
    }

    const value = meta[key];
    if (!Array.isArray(value)) {
      return [];
    }

    const result: string[] = [];
    for (const item of value) {
      if (typeof item === "string") {
        this.appendUniqueValue(result, item);
      }
    }

    return result;
  }

  private appendChangedFile(phaseId: string, filePath: string): void {
    if (!filePath) {
      return;
    }

    const phaseRuntime = this.stateMachine.getState().phases[phaseId];
    if (!phaseRuntime || phaseRuntime.changedFiles.includes(filePath)) {
      return;
    }

    this.stateMachine.updatePhase(phaseId, {
      changedFiles: [...phaseRuntime.changedFiles, filePath],
    });

    this.emit(SSEEventType.BLACKBOARD_UPDATED, {
      phaseId,
      changedFile: filePath,
    });
  }

  private appendExecutedCommand(phaseId: string, command: string | null): void {
    if (!command) {
      return;
    }

    const phaseRuntime = this.stateMachine.getState().phases[phaseId];
    if (!phaseRuntime || phaseRuntime.commandsExecuted.includes(command)) {
      return;
    }

    this.stateMachine.updatePhase(phaseId, {
      commandsExecuted: [...phaseRuntime.commandsExecuted, command],
    });

    this.emit(SSEEventType.BLACKBOARD_UPDATED, {
      phaseId,
      commandExecuted: command,
    });
  }

  private buildExecutedCommand(name: string, args: string): string | null {
    const trimmedName = name.trim();
    const trimmedArgs = args.trim();

    if (trimmedName.length === 0 && trimmedArgs.length === 0) {
      return null;
    }

    let rawCommand = "";

    if (trimmedArgs.length === 0) {
      rawCommand = trimmedName;
    } else if (trimmedName.length === 0) {
      rawCommand = trimmedArgs;
    } else {
      rawCommand = `${trimmedName} ${trimmedArgs}`;
    }

    return this.redactSensitiveText(rawCommand).value;
  }

  private extractEventSessionId(event: OpencodeEvent): string | null {
    switch (event.type) {
      case "session.status":
        return event.properties.sessionID;
      case "session.idle":
        return event.properties.sessionID;
      case "session.error":
        return event.properties.sessionID ?? null;
      case "message.updated":
        return event.properties.info.sessionID;
      case "message.part.updated":
        return event.properties.part.sessionID;
      case "message.part.removed":
        return event.properties.sessionID;
      case "todo.updated":
        return event.properties.sessionID;
      case "command.executed":
        return event.properties.sessionID;
      default:
        return null;
    }
  }

  private emit(type: SSEEventType, data: Record<string, unknown>): void {
    this.eventBus.emit({
      type,
      taskId: this.bindings.taskId,
      timestamp: new Date().toISOString(),
      data,
    });
  }
}
