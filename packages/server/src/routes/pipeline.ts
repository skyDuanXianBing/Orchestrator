// ============================================
// routes/pipeline.ts — 流水线控制路由
// ============================================

import { Router } from "express";
import type { Request, Response } from "express";
import type { TaskManager } from "../services/task-manager.js";
import type {
  ApiResponse,
  StartPipelineResponse,
  AbortPipelineResponse,
  ReviewRequest,
  ReviewResponse,
} from "@orchestrator/shared";

export function createPipelineRouter(taskManager: TaskManager): Router {
  const router = Router();

  const getParamAsString = (value: string | string[] | undefined): string => {
    if (Array.isArray(value)) {
      return value[0] ?? "";
    }
    return value ?? "";
  };

  /** POST /api/pipeline/:id/start — 启动流水线 */
  router.post("/:id/start", async (req: Request, res: Response) => {
    try {
      const taskId = getParamAsString(req.params.id);
      const result = await taskManager.startPipeline(taskId);

      const response: ApiResponse<StartPipelineResponse> = {
        success: true,
        data: result,
        error: null,
      };
      res.json(response);
    } catch (err) {
      const error = err instanceof Error ? err.message : "未知错误";
      const response: ApiResponse = {
        success: false,
        data: null,
        error,
      };
      res.status(500).json(response);
    }
  });

  /** POST /api/pipeline/:id/abort — 中止流水线 */
  router.post("/:id/abort", (req: Request, res: Response) => {
    try {
      const taskId = getParamAsString(req.params.id);
      const result = taskManager.abortPipeline(taskId);

      const response: ApiResponse<AbortPipelineResponse> = {
        success: true,
        data: result,
        error: null,
      };
      res.json(response);
    } catch (err) {
      const error = err instanceof Error ? err.message : "未知错误";
      const response: ApiResponse = {
        success: false,
        data: null,
        error,
      };
      res.status(500).json(response);
    }
  });

  /** POST /api/pipeline/:id/review — Phase 0R 人类审阅 */
  router.post("/:id/review", async (req: Request, res: Response) => {
    try {
      const taskId = getParamAsString(req.params.id);
      const body = req.body as ReviewRequest;

      if (!body.action) {
        const response: ApiResponse = {
          success: false,
          data: null,
          error: "缺少必填字段: action (approve | revise)",
        };
        res.status(400).json(response);
        return;
      }

      const result = await taskManager.handleReview(taskId, body);

      const response: ApiResponse<ReviewResponse> = {
        success: true,
        data: result,
        error: null,
      };
      res.json(response);
    } catch (err) {
      const error = err instanceof Error ? err.message : "未知错误";
      const response: ApiResponse = {
        success: false,
        data: null,
        error,
      };
      res.status(500).json(response);
    }
  });

  return router;
}
