// ============================================
// utils/http.ts — 统一 HTTP 请求封装
// ============================================

import type { ApiResponse } from "@orchestrator/shared";
import { i18n } from "../i18n";

/** 获取当前翻译函数（非组件上下文安全） */
function t(key: string, params?: Record<string, unknown>): string {
  return i18n.global.t(key, params ?? {});
}

/** HTTP 请求错误 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly serverError: string | null,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** 通用请求方法 */
async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const mergedOptions: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers as Record<string, string> | undefined),
    },
  };

  let response: Response;
  try {
    response = await fetch(url, mergedOptions);
  } catch (err) {
    const message = err instanceof Error ? err.message : t("http.networkError");
    throw new HttpError(0, null, t("http.requestFailed", { message }));
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  let body: ApiResponse<T>;
  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new HttpError(response.status, null, t("http.parseFailed"));
  }

  if (!body.success || body.data === null) {
    throw new HttpError(
      response.status,
      body.error,
      body.error ?? t("http.statusFailed", { status: response.status }),
    );
  }

  return body.data;
}

/** GET 请求 */
export function httpGet<T>(url: string): Promise<T> {
  return request<T>(url, { method: "GET" });
}

/** POST 请求 */
export function httpPost<T>(url: string, data?: unknown): Promise<T> {
  return request<T>(url, {
    method: "POST",
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
}

/** DELETE 请求 */
export function httpDelete<T>(url: string): Promise<T> {
  return request<T>(url, { method: "DELETE" });
}
