// ============================================
// composables/useSSE.ts — SSE 事件订阅
// ============================================

import { ref, onUnmounted } from "vue";
import type { SSEEvent, SSEEventType } from "@orchestrator/shared";
import { i18n } from "../i18n";

export interface SSELogEntry {
  id: number;
  timestamp: string;
  type: string;
  message: string;
  level: "info" | "warn" | "error" | "debug";
}

/** SSE 事件类型回调映射 */
export type SSEEventHandler = (event: SSEEvent) => void;

/** 获取当前翻译函数（非组件上下文安全） */
function t(key: string, params?: Record<string, unknown>): string {
  return i18n.global.t(key, params ?? {});
}

export function useSSE(taskId: string) {
  const connected = ref(false);
  const logs = ref<SSELogEntry[]>([]);
  const latestEvent = ref<SSEEvent | null>(null);

  let eventSource: EventSource | null = null;
  let logIdCounter = 0;
  const handlers = new Map<string, Set<SSEEventHandler>>();

  /** 注册特定事件类型的回调 */
  function on(eventType: SSEEventType | string, handler: SSEEventHandler): void {
    const existing = handlers.get(eventType);
    if (existing) {
      existing.add(handler);
      return;
    }

    handlers.set(eventType, new Set([handler]));
  }

  /** 将 SSE 事件转为日志条目 */
  function eventToLog(event: SSEEvent): SSELogEntry {
    const data = event.data as Record<string, unknown>;

    let message = "";
    let level: SSELogEntry["level"] = "info";

    switch (event.type) {
      case "pipeline_started":
        message = t("sse.pipelineStarted");
        break;
      case "phase_started":
        message = t("sse.phaseStarted", {
          phaseId: data.phaseId ?? "",
          description: data.description ?? "",
        });
        break;
      case "phase_completed":
        message = t("sse.phaseCompleted", { phaseId: data.phaseId ?? "" });
        break;
      case "phase_failed":
        message = t("sse.phaseFailed", {
          phaseId: data.phaseId ?? "",
          error: data.errorSummary ?? "",
        });
        level = "error";
        break;
      case "gate_passed":
        message = t("sse.gatePassed", { phaseId: data.phaseId ?? "" });
        break;
      case "gate_failed":
        message = t("sse.gateFailed", { phaseId: data.phaseId ?? "" });
        level = "warn";
        break;
      case "human_review_required":
        message = t("sse.humanReviewRequired", { phaseId: data.phaseId ?? "" });
        level = "warn";
        break;
      case "human_review_completed":
        message = t("sse.humanReviewCompleted", { phaseId: data.phaseId ?? "" });
        break;
      case "circuit_breaker_triggered":
        message = t("sse.circuitBreakerTriggered", { phaseId: data.phaseId ?? "" });
        level = "error";
        break;
      case "pipeline_completed":
        message = t("sse.pipelineCompleted");
        break;
      case "pipeline_failed":
        message = t("sse.pipelineFailed", { error: data.error ?? "" });
        level = "error";
        break;
      case "pipeline_aborted":
        message = t("sse.pipelineAborted");
        level = "warn";
        break;
      case "log_message":
        message = String(data.message ?? "");
        level = (data.level as SSELogEntry["level"]) ?? "info";
        break;
      case "blackboard_updated":
        message = t("sse.blackboardUpdated");
        level = "debug";
        break;
      default:
        message = JSON.stringify(data);
    }

    logIdCounter++;
    return {
      id: logIdCounter,
      timestamp: event.timestamp,
      type: event.type,
      message,
      level,
    };
  }

  /** 连接 SSE */
  function connect(): void {
    if (eventSource) {
      eventSource.close();
    }

    const url = `/api/events/${taskId}`;
    eventSource = new EventSource(url);

    eventSource.onopen = () => {
      connected.value = true;
    };

    eventSource.onerror = () => {
      connected.value = false;
      // EventSource 会自动重连
    };

    // 监听 connected 初始事件
    eventSource.addEventListener("connected", () => {
      connected.value = true;
    });

    // 为所有已注册的事件类型添加 listener
    const allEventTypes = [
      "pipeline_started",
      "phase_started",
      "phase_completed",
      "phase_failed",
      "gate_passed",
      "gate_failed",
      "human_review_required",
      "human_review_completed",
      "circuit_breaker_triggered",
      "pipeline_completed",
      "pipeline_failed",
      "pipeline_aborted",
      "log_message",
      "blackboard_updated",
    ];

    for (const eventType of allEventTypes) {
      eventSource.addEventListener(eventType, (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data) as SSEEvent;
          latestEvent.value = parsed;

          // 添加到日志
          const logEntry = eventToLog(parsed);
          logs.value.push(logEntry);

          // 限制日志数量，最多保留 500 条
          if (logs.value.length > 500) {
            logs.value = logs.value.slice(-500);
          }

          // 调用注册的回调
          const typeHandlers = handlers.get(eventType);
          if (typeHandlers) {
            for (const handler of typeHandlers) {
              handler(parsed);
            }
          }
        } catch {
          // 忽略解析失败的事件
        }
      });
    }
  }

  /** 断开 SSE */
  function disconnect(): void {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    connected.value = false;
  }

  /** 清空日志 */
  function clearLogs(): void {
    logs.value = [];
    logIdCounter = 0;
  }

  // 组件卸载时自动断开
  onUnmounted(() => {
    disconnect();
  });

  return {
    connected,
    logs,
    latestEvent,
    on,
    connect,
    disconnect,
    clearLogs,
  };
}
