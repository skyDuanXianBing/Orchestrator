// ============================================
// utils/event-bus.ts — 进程内事件总线（SSE 推送源）
// ============================================

import { EventEmitter } from "node:events";
import type { SSEEvent } from "@orchestrator/shared";
import type {
  EventRepository,
  PersistedSSEEvent,
} from "../db/repositories/event-repository.js";

interface SequencedEventPayload {
  seq: number | null;
  event: SSEEvent;
}

/**
 * 进程内事件总线
 * - 后端模块通过 emit() 发布事件
 * - SSE 路由通过 subscribe() 监听事件并推送给前端
 */
export class EventBus {
  private emitter: EventEmitter;
  private eventRepository: EventRepository | null;

  constructor(eventRepository?: EventRepository) {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
    this.eventRepository = eventRepository ?? null;
  }

  /** 发布事件 */
  emit(event: SSEEvent): void {
    let persistedSeq: number | null = null;
    if (this.eventRepository) {
      persistedSeq = this.eventRepository.appendEvent(event);
    }

    this.emitter.emit("sse_with_seq", {
      seq: persistedSeq,
      event,
    } satisfies SequencedEventPayload);

    this.emitter.emit("sse", event);
  }

  /** 查询任务历史事件（用于回放） */
  listPersistedEvents(taskId: string, lastSeq: number): PersistedSSEEvent[] {
    if (!this.eventRepository) {
      return [];
    }

    return this.eventRepository.listEventsByTask(taskId, lastSeq);
  }

  /** 订阅所有 SSE 事件 */
  subscribe(listener: (event: SSEEvent) => void): void {
    this.emitter.on("sse", listener);
  }

  /** 取消订阅 */
  unsubscribe(listener: (event: SSEEvent) => void): void {
    this.emitter.off("sse", listener);
  }

  /** 按 taskId 过滤的订阅 */
  subscribeByTask(
    taskId: string,
    listener: (event: SSEEvent) => void,
  ): () => void {
    const filtered = (event: SSEEvent) => {
      if (event.taskId === taskId) {
        listener(event);
      }
    };
    this.emitter.on("sse", filtered);
    return () => this.emitter.off("sse", filtered);
  }

  /** 按 taskId 过滤并携带 seq 的订阅 */
  subscribeByTaskWithSeq(
    taskId: string,
    listener: (payload: SequencedEventPayload) => void,
  ): () => void {
    const filtered = (payload: SequencedEventPayload) => {
      if (payload.event.taskId === taskId) {
        listener(payload);
      }
    };

    this.emitter.on("sse_with_seq", filtered);
    return () => this.emitter.off("sse_with_seq", filtered);
  }
}
