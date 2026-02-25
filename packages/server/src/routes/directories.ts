// ============================================
// routes/directories.ts — 本地目录浏览路由
// ============================================

import { readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Router } from "express";
import type { Request, Response } from "express";
import type { ApiResponse } from "@orchestrator/shared";

interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface DirectoryListResponse {
  currentPath: string;
  parentPath: string | null;
  entries: DirectoryEntry[];
}

function getPathQueryValue(value: Request["query"]["path"]): string {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : "";
  }

  return typeof value === "string" ? value : "";
}

export function createDirectoriesRouter(): Router {
  const router = Router();

  /** GET /api/directories — 获取目录下的子目录列表 */
  router.get("/directories", async (req: Request, res: Response) => {
    try {
      const rawPath = getPathQueryValue(req.query.path).trim();
      const targetPath = rawPath.length > 0 ? rawPath : os.homedir();
      const currentPath = path.resolve(targetPath);

      const directoryItems = await readdir(currentPath, { withFileTypes: true });
      const entries: DirectoryEntry[] = directoryItems
        .filter((item) => item.isDirectory() && !item.name.startsWith("."))
        .map((item) => ({
          name: item.name,
          path: path.join(currentPath, item.name),
          isDirectory: true,
        }))
        .sort((left, right) => left.name.localeCompare(right.name));

      const computedParentPath = path.dirname(currentPath);
      const parentPath =
        computedParentPath === currentPath ? null : computedParentPath;

      const response: ApiResponse<DirectoryListResponse> = {
        success: true,
        data: {
          currentPath,
          parentPath,
          entries,
        },
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

      res.status(400).json(response);
    }
  });

  return router;
}
