// ============================================
// routes/health.ts — 健康检查路由
// ============================================

import { Router } from "express";
import type { Request, Response } from "express";
import type { TaskManager } from "../services/task-manager.js";
import type { ApiResponse, HealthResponse } from "@orchestrator/shared";

const startTime = Date.now();

export function createHealthRouter(taskManager: TaskManager): Router {
  const router = Router();

  /** GET /api/health — 健康检查 */
  router.get("/health", (_req: Request, res: Response) => {
    const response: ApiResponse<HealthResponse> = {
      success: true,
      data: {
        status: "ok",
        version: "0.1.0",
        uptime: Date.now() - startTime,
        activeTasks: taskManager.getActiveTaskCount(),
      },
      error: null,
    };
    res.json(response);
  });

  /** GET /api/agents — 可用代理列表 */
  router.get("/agents", (_req: Request, res: Response) => {
    const agents = taskManager.getAvailableAgents();
    const response: ApiResponse<typeof agents> = {
      success: true,
      data: agents,
      error: null,
    };
    res.json(response);
  });

  return router;
}
