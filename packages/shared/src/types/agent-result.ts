// ============================================
// types/agent-result.ts - 子代理返回结果解析
// ============================================

export interface AgentStructuredResult {
  status: "SUCCESS" | "FAILED" | "PARTIAL";
  summary: string;
  changed_files: string[];
  commands_executed: string[];
  artifact_pointers: string[];
  error_summary: string | null;
  next_suggestion: string | null;
}

function isStringArray(value: unknown): value is string[] {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every((item) => typeof item === "string");
}

function normalizeParsedResult(parsed: unknown): AgentStructuredResult | null {
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const data = parsed as Record<string, unknown>;
  const status = data.status;
  const summary = data.summary;

  if (
    status !== "SUCCESS"
    && status !== "FAILED"
    && status !== "PARTIAL"
  ) {
    return null;
  }

  if (typeof summary !== "string" || summary.trim().length === 0) {
    return null;
  }

  return {
    status,
    summary,
    changed_files: isStringArray(data.changed_files) ? data.changed_files : [],
    commands_executed: isStringArray(data.commands_executed) ? data.commands_executed : [],
    artifact_pointers: isStringArray(data.artifact_pointers) ? data.artifact_pointers : [],
    error_summary: typeof data.error_summary === "string" ? data.error_summary : null,
    next_suggestion: typeof data.next_suggestion === "string" ? data.next_suggestion : null,
  };
}

function extractJsonCandidates(rawText: string): string[] {
  const candidates: string[] = [];
  const trimmed = rawText.trim();

  if (trimmed.length > 0) {
    candidates.push(trimmed);
  }

  const fencedMatches = trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi);
  for (const match of fencedMatches) {
    const content = match[1]?.trim();
    if (content) {
      candidates.push(content);
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  return candidates;
}

export function parseAgentResult(rawText: string): AgentStructuredResult {
  const candidates = extractJsonCandidates(rawText);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const normalized = normalizeParsedResult(parsed);
      if (normalized) {
        return normalized;
      }
    } catch {
      // Continue trying other candidates.
    }
  }

  return {
    status: "FAILED",
    summary: "Agent response is not valid structured JSON.",
    changed_files: [],
    commands_executed: [],
    artifact_pointers: [],
    error_summary: rawText.slice(0, 500),
    next_suggestion: null,
  };
}
