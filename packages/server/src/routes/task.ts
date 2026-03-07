// ============================================
// routes/task.ts — 任务 CRUD 路由
// ============================================

import { Router } from "express";
import type { Request, Response } from "express";
import type { TaskManager } from "../services/task-manager.js";
import { Category, Mode } from "@orchestrator/shared";
import type {
  ApiResponse,
  CreateTaskRequest,
  CreateTaskResponse,
  TaskDetailResponse,
  TaskListResponse,
} from "@orchestrator/shared";

export function createTaskRouter(taskManager: TaskManager): Router {
  const router = Router();

  const isEnumValue = <T extends string>(values: readonly string[], input: string): input is T => {
    return values.includes(input);
  };

  const getParamAsString = (value: string | string[] | undefined): string => {
    if (Array.isArray(value)) {
      return value[0] ?? "";
    }
    return value ?? "";
  };

  /** POST /api/task — 创建任务 */
  router.post("/", (req: Request, res: Response) => {
    try {
      const body = req.body as CreateTaskRequest;

      if (!body.requirement || !body.category || !body.mode) {
        const response: ApiResponse = {
          success: false,
          data: null,
          error: "缺少必填字段: requirement, category, mode",
        };
        res.status(400).json(response);
        return;
      }

      if (!isEnumValue<Category>(Object.values(Category), body.category)) {
        const response: ApiResponse = {
          success: false,
          data: null,
          error: `非法 category: ${body.category}`,
        };
        res.status(400).json(response);
        return;
      }

      if (!isEnumValue<Mode>(Object.values(Mode), body.mode)) {
        const response: ApiResponse = {
          success: false,
          data: null,
          error: `非法 mode: ${body.mode}`,
        };
        res.status(400).json(response);
        return;
      }

      const result = taskManager.createTask(body);
      const response: ApiResponse<CreateTaskResponse> = {
        success: true,
        data: result,
        error: null,
      };
      res.status(201).json(response);
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

  /** GET /api/task — 列出所有任务 */
  router.get("/", (_req: Request, res: Response) => {
    try {
      const result = taskManager.listTasks();
      const response: ApiResponse<TaskListResponse> = {
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

  /** GET /api/task/:id — 获取任务详情 */
  router.get("/:id", (req: Request, res: Response) => {
    try {
      const taskId = getParamAsString(req.params.id);
      const result = taskManager.getTaskDetail(taskId);

      if (!result) {
        const response: ApiResponse = {
          success: false,
          data: null,
          error: `任务 ${taskId} 不存在`,
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<TaskDetailResponse> = {
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

  /** DELETE /api/task/:id — 删除任务 */
  router.delete("/:id", (req: Request, res: Response) => {
    try {
      const taskId = getParamAsString(req.params.id);
      const deleted = taskManager.deleteTask(taskId);

      if (!deleted) {
        const response: ApiResponse = {
          success: false,
          data: null,
          error: `任务 ${taskId} 不存在`,
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<{ taskId: string }> = {
        success: true,
        data: { taskId },
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
