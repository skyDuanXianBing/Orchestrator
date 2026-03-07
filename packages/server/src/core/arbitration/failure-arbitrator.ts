// ============================================
// core/arbitration/failure-arbitrator.ts
// ============================================

import type { OpencodeClient, Part } from "@opencode-ai/sdk";
import type {
  AgentName,
  ArbitrationDecision,
  ArbitrationDecisionAction,
  ArbitrationRiskLevel,
  PhaseDefinition,
} from "@orchestrator/shared";
import { FAILURE_ARBITRATOR_SYSTEM_PROMPT } from "./failure-arbitrator-prompt.js";

const ARBITRATION_MODEL = "gpt5.2 high";
const DEFAULT_LLM_TIMEOUT_MS = 6000;
const RAW_RESPONSE_SNIPPET_LIMIT = 400;

const ALLOWED_ACTIONS: readonly ArbitrationDecisionAction[] = [
  "PASS_WITH_WARN",
  "REQUEST_MORE_EVIDENCE",
  "RETRY_SAME_AGENT",
  "SWITCH_AGENT",
  "BLOCK",
];

const ALLOWED_RISK_LEVELS: readonly ArbitrationRiskLevel[] = ["LOW", "MEDIUM", "HIGH"];

export type ArbitrationMode = "rule" | "llm" | "hybrid";

type LlmErrorType =
  | "timeout"
  | "sdk_error"
  | "response_error"
  | "non_json"
  | "invalid_schema";

export interface FailureArbitrationContext {
  phase: PhaseDefinition;
  activeAgent: AgentName;
  category: string;
  mode: string;
  reason: string;
  details: string | null;
  shouldRetry: boolean;
  retryCount: number;
  maxRetries: number;
  fingerprint: string;
  taskId: string;
  docPath: string;
  projectPath: string;
  sessionId: string | null;
}

export interface ArbitrationReviewContextMeta {
  arbitration_mode: ArbitrationMode;
  llm_attempted: boolean;
  fallback_used: boolean;
  llm_error_type: string | null;
  parse_error: string | null;
  raw_response_snippet: string | null;
  evidence_request: string | null;
  unknown_mode_value: string | null;
}

export interface ArbitrationWithMetaResult {
  decision: ArbitrationDecision;
  reviewContextMeta: ArbitrationReviewContextMeta;
}

export interface FailureArbitratorDeps {
  getClient: (projectPath: string) => Promise<OpencodeClient>;
  runRuleArbitration: (context: FailureArbitrationContext) => ArbitrationDecision;
  llmTimeoutMs?: number;
}

interface ResolvedMode {
  mode: ArbitrationMode;
  unknownModeValue: string | null;
}

interface ParsedLlmResult {
  decision: ArbitrationDecision;
  rawResponseSnippet: string;
}

class LlmArbitrationError extends Error {
  readonly errorType: LlmErrorType;
  readonly rawResponseSnippet: string | null;
  readonly parseError: string | null;

  constructor(
    errorType: LlmErrorType,
    message: string,
    rawResponseSnippet: string | null = null,
    parseError: string | null = null,
  ) {
    super(message);
    this.name = "LlmArbitrationError";
    this.errorType = errorType;
    this.rawResponseSnippet = rawResponseSnippet;
    this.parseError = parseError;
  }
}

export async function arbitrateFailureWithMode(
  context: FailureArbitrationContext,
  deps: FailureArbitratorDeps,
): Promise<ArbitrationWithMetaResult> {
  const resolvedMode = resolveArbitrationMode(process.env.ARBITRATION_MODE);
  const reviewContextMeta: ArbitrationReviewContextMeta = {
    arbitration_mode: resolvedMode.mode,
    llm_attempted: false,
    fallback_used: false,
    llm_error_type: null,
    parse_error: null,
    raw_response_snippet: null,
    evidence_request: null,
    unknown_mode_value: resolvedMode.unknownModeValue,
  };

  if (resolvedMode.mode === "rule") {
    const ruleDecision = deps.runRuleArbitration(context);
    reviewContextMeta.evidence_request = ruleDecision.evidence_request ?? null;
    return {
      decision: ruleDecision,
      reviewContextMeta,
    };
  }

  reviewContextMeta.llm_attempted = true;

  try {
    const llmResult = await invokeLlmArbitration(context, deps);
    reviewContextMeta.raw_response_snippet = llmResult.rawResponseSnippet;
    reviewContextMeta.evidence_request = llmResult.decision.evidence_request ?? null;
    return {
      decision: llmResult.decision,
      reviewContextMeta,
    };
  } catch (error) {
    const normalizedError = normalizeLlmError(error);
    reviewContextMeta.fallback_used = true;
    reviewContextMeta.llm_error_type = normalizedError.errorType;
    reviewContextMeta.parse_error = normalizedError.parseError;
    reviewContextMeta.raw_response_snippet = normalizedError.rawResponseSnippet;

    const ruleDecision = deps.runRuleArbitration(context);
    reviewContextMeta.evidence_request = ruleDecision.evidence_request ?? null;
    return {
      decision: ruleDecision,
      reviewContextMeta,
    };
  }
}

function resolveArbitrationMode(rawMode: string | undefined): ResolvedMode {
  if (!rawMode || rawMode.trim().length === 0) {
    return {
      mode: "hybrid",
      unknownModeValue: null,
    };
  }

  const normalizedMode = rawMode.trim().toLowerCase();
  if (normalizedMode === "rule" || normalizedMode === "llm" || normalizedMode === "hybrid") {
    return {
      mode: normalizedMode,
      unknownModeValue: null,
    };
  }

  return {
    mode: "hybrid",
    unknownModeValue: rawMode,
  };
}

async function invokeLlmArbitration(
  context: FailureArbitrationContext,
  deps: FailureArbitratorDeps,
): Promise<ParsedLlmResult> {
  const client = await deps.getClient(context.projectPath);
  const llmTimeoutMs = deps.llmTimeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;
  const model = ARBITRATION_MODEL as unknown as {
    providerID: string;
    modelID: string;
  };

  const promptResult = await withTimeout(
    client.session.prompt({
      query: { directory: context.projectPath },
      path: { id: context.sessionId ?? `arbitration-${context.phase.phaseId}` },
      body: {
        model,
        parts: [
          {
            type: "text",
            text: FAILURE_ARBITRATOR_SYSTEM_PROMPT,
          },
          {
            type: "text",
            text: buildFailureContextPrompt(context),
          },
        ],
      },
    }),
    llmTimeoutMs,
  );

  if (promptResult.error || !promptResult.data) {
    throw new LlmArbitrationError("response_error", "LLM response is empty or has transport error.");
  }

  if (promptResult.data.info.error) {
    const detail = promptResult.data.info.error.data?.message;
    const message = detail
      ? `LLM info.error: ${promptResult.data.info.error.name}: ${detail}`
      : `LLM info.error: ${promptResult.data.info.error.name}`;
    throw new LlmArbitrationError("response_error", message);
  }

  const rawResponse = extractText(promptResult.data.parts);
  if (rawResponse.length === 0) {
    throw new LlmArbitrationError("non_json", "LLM response is empty.");
  }

  const parsedDecision = parseAndValidateDecision(rawResponse);
  return {
    decision: parsedDecision,
    rawResponseSnippet: boundedSnippet(rawResponse),
  };
}

async function withTimeout<T>(task: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;

  const timeoutTask = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new LlmArbitrationError("timeout", `LLM arbitration timeout after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([task, timeoutTask]);
  } catch (error) {
    if (error instanceof LlmArbitrationError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new LlmArbitrationError("sdk_error", message);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function buildFailureContextPrompt(context: FailureArbitrationContext): string {
  const payload = {
    phase: {
      phase_id: context.phase.phaseId,
      type: context.phase.type,
      description: context.phase.description,
      gate_condition: context.phase.gateCondition,
    },
    agent: context.activeAgent,
    category: context.category,
    mode: context.mode,
    failure: {
      reason: context.reason,
      details: context.details,
      fingerprint: context.fingerprint,
    },
    retry: {
      should_retry: context.shouldRetry,
      current_count: context.retryCount,
      max_count: context.maxRetries,
    },
    task: {
      task_id: context.taskId,
      doc_path: context.docPath,
      project_path: context.projectPath,
    },
  };

  return [
    "Analyze the following failure context and return arbitration decision JSON.",
    "Output must be a single JSON object only.",
    JSON.stringify(payload, null, 2),
  ].join("\n\n");
}

function extractText(parts: Part[]): string {
  const textList: string[] = [];

  for (const part of parts) {
    if (part.type === "text") {
      textList.push(part.text);
    }
  }

  return textList.join("\n").trim();
}

function parseAndValidateDecision(rawResponse: string): ArbitrationDecision {
  const snippet = boundedSnippet(rawResponse);

  let parsedUnknown: unknown;
  try {
    parsedUnknown = JSON.parse(rawResponse);
  } catch (error) {
    const parseMessage = error instanceof Error ? error.message : "JSON.parse failed";
    throw new LlmArbitrationError("non_json", "LLM output is not valid JSON.", snippet, parseMessage);
  }

  if (!isRecord(parsedUnknown)) {
    throw new LlmArbitrationError("invalid_schema", "LLM output root is not an object.", snippet);
  }

  const requiredFields = [
    "decision_id",
    "phase_id",
    "recommended_action",
    "risk_level",
    "confidence",
    "reason_code",
    "reason_params",
    "uncertain",
    "failure_class",
    "summary",
    "recommended_agent",
    "evidence_request",
  ];

  for (const field of requiredFields) {
    if (!Object.prototype.hasOwnProperty.call(parsedUnknown, field)) {
      throw new LlmArbitrationError(
        "invalid_schema",
        `LLM output missing required field: ${field}`,
        snippet,
      );
    }
  }

  const decisionId = readRequiredString(parsedUnknown, "decision_id", snippet);
  const phaseId = readRequiredString(parsedUnknown, "phase_id", snippet);
  const recommendedAction = readRecommendedAction(parsedUnknown, "recommended_action", snippet);
  const riskLevel = readRiskLevel(parsedUnknown, "risk_level", snippet);
  const confidence = readConfidence(parsedUnknown, "confidence", snippet);
  const reasonCode = readRequiredString(parsedUnknown, "reason_code", snippet);
  const reasonParams = readReasonParams(parsedUnknown, "reason_params", snippet);
  const uncertain = readRequiredBoolean(parsedUnknown, "uncertain", snippet);
  const failureClass = readRequiredString(parsedUnknown, "failure_class", snippet);
  const summary = readNullableString(parsedUnknown, "summary", snippet);
  const recommendedAgent = readNullableString(parsedUnknown, "recommended_agent", snippet);
  const evidenceRequest = readNullableString(parsedUnknown, "evidence_request", snippet);

  return {
    decision_id: decisionId,
    phase_id: phaseId,
    recommended_action: recommendedAction,
    risk_level: riskLevel,
    confidence,
    reason_code: reasonCode,
    reason_params: reasonParams,
    uncertain,
    failure_class: failureClass,
    summary,
    recommended_agent: recommendedAgent as AgentName | null,
    evidence_request: evidenceRequest,
  };
}

function readRequiredString(
  source: Record<string, unknown>,
  key: string,
  snippet: string,
): string {
  const value = source[key];
  if (typeof value !== "string") {
    throw new LlmArbitrationError("invalid_schema", `${key} must be string.`, snippet);
  }
  return value;
}

function readRequiredBoolean(
  source: Record<string, unknown>,
  key: string,
  snippet: string,
): boolean {
  const value = source[key];
  if (typeof value !== "boolean") {
    throw new LlmArbitrationError("invalid_schema", `${key} must be boolean.`, snippet);
  }
  return value;
}

function readNullableString(
  source: Record<string, unknown>,
  key: string,
  snippet: string,
): string | null {
  const value = source[key];
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new LlmArbitrationError("invalid_schema", `${key} must be string|null.`, snippet);
  }

  return value;
}

function readRecommendedAction(
  source: Record<string, unknown>,
  key: string,
  snippet: string,
): ArbitrationDecisionAction {
  const value = source[key];
  if (typeof value !== "string") {
    throw new LlmArbitrationError("invalid_schema", `${key} must be string.`, snippet);
  }

  if (!ALLOWED_ACTIONS.includes(value as ArbitrationDecisionAction)) {
    throw new LlmArbitrationError("invalid_schema", `${key} is invalid enum value.`, snippet);
  }

  return value as ArbitrationDecisionAction;
}

function readRiskLevel(
  source: Record<string, unknown>,
  key: string,
  snippet: string,
): ArbitrationRiskLevel {
  const value = source[key];
  if (typeof value !== "string") {
    throw new LlmArbitrationError("invalid_schema", `${key} must be string.`, snippet);
  }

  if (!ALLOWED_RISK_LEVELS.includes(value as ArbitrationRiskLevel)) {
    throw new LlmArbitrationError("invalid_schema", `${key} is invalid enum value.`, snippet);
  }

  return value as ArbitrationRiskLevel;
}

function readConfidence(
  source: Record<string, unknown>,
  key: string,
  snippet: string,
): number {
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new LlmArbitrationError("invalid_schema", `${key} must be finite number.`, snippet);
  }
  return value;
}

function readReasonParams(
  source: Record<string, unknown>,
  key: string,
  snippet: string,
): Record<string, string | number | boolean> {
  const value = source[key];
  if (!isRecord(value)) {
    throw new LlmArbitrationError("invalid_schema", `${key} must be object.`, snippet);
  }

  const result: Record<string, string | number | boolean> = {};
  for (const [paramKey, paramValue] of Object.entries(value)) {
    if (typeof paramValue !== "string" && typeof paramValue !== "number" && typeof paramValue !== "boolean") {
      throw new LlmArbitrationError(
        "invalid_schema",
        `${key}.${paramKey} must be string|number|boolean.`,
        snippet,
      );
    }

    result[paramKey] = paramValue;
  }

  return result;
}

function boundedSnippet(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= RAW_RESPONSE_SNIPPET_LIMIT) {
    return trimmed;
  }
  return `${trimmed.slice(0, RAW_RESPONSE_SNIPPET_LIMIT)}...`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeLlmError(error: unknown): LlmArbitrationError {
  if (error instanceof LlmArbitrationError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  return new LlmArbitrationError("sdk_error", message);
}
