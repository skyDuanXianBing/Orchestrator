// ============================================
// routes/events.ts — SSE 实时事件流
// ============================================

import { Router } from "express";
import type { Request, Response } from "express";
import type { EventBus } from "../utils/event-bus.js";
import type { SSEEvent } from "@orchestrator/shared";

export function createEventRouter(eventBus: EventBus): Router {
  const router = Router();

  const getParamAsString = (value: string | string[] | undefined): string => {
    if (Array.isArray(value)) {
      return value[0] ?? "";
    }
    return value ?? "";
  };

  const parseLastSeq = (value: unknown): number => {
    if (typeof value !== "string" || value.trim().length === 0) {
      return 0;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed < 0) {
      return 0;
    }

    return Math.floor(parsed);
  };

  /** GET /api/events/:taskId — SSE 实时事件流 */
  router.get("/:taskId", (req: Request, res: Response) => {
    const taskId = getParamAsString(req.params.taskId);
    const queryLastSeq = parseLastSeq(req.query.lastSeq);
    const headerLastSeq = parseLastSeq(req.header("last-event-id"));
    const lastSeq = queryLastSeq > 0 ? queryLastSeq : headerLastSeq;

    // 设置 SSE 响应头
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // 发送初始连接确认
    res.write(`event: connected\ndata: ${JSON.stringify({ taskId })}\n\n`);

    // 先回放历史事件，再订阅实时事件
    const replayEvents = eventBus.listPersistedEvents(taskId, lastSeq);
    for (const replayEvent of replayEvents) {
      const eventName = replayEvent.event.type;
      const data = JSON.stringify(replayEvent.event);
      res.write(`id: ${replayEvent.seq}\nevent: ${eventName}\ndata: ${data}\n\n`);
    }

    // 订阅该任务的事件
    const seqListener = ({ seq, event }: { seq: number | null; event: SSEEvent }) => {
      const eventName = event.type;
      const data = JSON.stringify(event);
      if (seq && seq > 0) {
        res.write(`id: ${seq}\nevent: ${eventName}\ndata: ${data}\n\n`);
        return;
      }

      res.write(`event: ${eventName}\ndata: ${data}\n\n`);
    };

    const unsubscribeWithSeq = eventBus.subscribeByTaskWithSeq(taskId, seqListener);

    // 心跳保活
    const heartbeat = setInterval(() => {
      res.write(`:heartbeat ${new Date().toISOString()}\n\n`);
    }, 15000);

    // 客户端断开连接时清理
    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribeWithSeq();
    });
  });

  return router;
}
