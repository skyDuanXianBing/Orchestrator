// ============================================
// core/client.ts - Opencode SDK 客户端管理
// 3 层自动连接策略:
//   Tier 1: 环境变量 OPENCODE_BASE_URL 直连
//   Tier 2: 并发探测候选端口 (4096-4100) 复用已有服务
//   Tier 3: 自启动 opencode 服务，端口冲突自动跳下一个
// ============================================

import {
  createOpencodeServer,
  createOpencodeClient,
  type OpencodeClient,
} from "@opencode-ai/sdk";
import type { Logger } from "../utils/logger.js";

/** 默认监听主机 */
const DEFAULT_HOSTNAME = "127.0.0.1";

/** 候选端口列表（opencode 默认 4096，额外回退 4 个） */
const CANDIDATE_PORTS = [4096, 4097, 4098, 4099, 4100];

/** Tier 2 单端口探测超时 (ms) */
const PROBE_TIMEOUT_MS = 1500;

/** Tier 3 服务启动超时 (ms) */
const SERVER_START_TIMEOUT_MS = 8000;

interface ManagedServer {
  url: string;
  close(): void;
}

export class OpencodeClientManager {
  private client: OpencodeClient | null = null;
  private managedServer: ManagedServer | null = null;
  private initPromise: Promise<OpencodeClient> | null = null;

  constructor(private logger: Logger) {}

  /**
   * 获取 SDK 客户端实例（懒初始化，单例）。
   * 第一次调用时按 Tier 1 → 2 → 3 顺序尝试连接。
   */
  async getClient(projectPath: string): Promise<OpencodeClient> {
    if (this.client) {
      return this.client;
    }

    if (!this.initPromise) {
      this.initPromise = this.initialize(projectPath);
    }

    return this.initPromise;
  }

  /** 关闭自管理的 opencode 服务并重置状态，允许后续重新初始化 */
  close(): void {
    if (this.managedServer) {
      this.managedServer.close();
      this.logger.info("Opencode managed server closed");
      this.managedServer = null;
    }
    this.client = null;
    this.initPromise = null;
  }

  // ─── 初始化入口 ───────────────────────────────

  private async initialize(projectPath: string): Promise<OpencodeClient> {
    // ── Tier 1: 环境变量直连 ──
    const envClient = this.connectViaEnv(projectPath);
    if (envClient) {
      return envClient;
    }

    // ── Tier 2: 端口探测已有服务 ──
    const probeClient = await this.probeExistingServer(projectPath);
    if (probeClient) {
      return probeClient;
    }

    // ── Tier 3: 自启动回退（依次尝试候选端口） ──
    const startClient = await this.startNewServer(projectPath);
    if (startClient) {
      return startClient;
    }

    // 全部失败 — 给出明确建议
    const hint = [
      "所有自动连接策略均失败，请手动排查:",
      `  1. 确认 opencode CLI 已安装: which opencode`,
      `  2. 手动启动: opencode serve --port 4096`,
      `  3. 设置环境变量: OPENCODE_BASE_URL=http://127.0.0.1:4096`,
    ].join("\n");

    throw new Error(
      `无法连接或启动 opencode 服务 (已探测端口 ${CANDIDATE_PORTS.join(", ")})\n${hint}`,
    );
  }

  // ─── Tier 1: 环境变量 ─────────────────────────

  private connectViaEnv(projectPath: string): OpencodeClient | null {
    const baseUrl = process.env.OPENCODE_BASE_URL;
    if (!baseUrl) {
      return null;
    }

    this.client = createOpencodeClient({
      baseUrl,
      directory: projectPath,
    });
    this.logger.info(`[Tier 1] 通过环境变量连接 opencode 服务: ${baseUrl}`);
    return this.client;
  }

  // ─── Tier 2: 并发端口探测 ─────────────────────

  private async probeExistingServer(projectPath: string): Promise<OpencodeClient | null> {
    this.logger.info(
      `[Tier 2] 探测端口 ${CANDIDATE_PORTS.join(", ")} 是否有运行中的 opencode 服务...`,
    );

    const probeResults = await Promise.allSettled(
      CANDIDATE_PORTS.map((port) => this.probePort(port)),
    );

    for (let i = 0; i < probeResults.length; i++) {
      const result = probeResults[i];
      if (result.status === "fulfilled" && result.value) {
        const port = CANDIDATE_PORTS[i];
        const baseUrl = `http://${DEFAULT_HOSTNAME}:${port}`;

        this.client = createOpencodeClient({
          baseUrl,
          directory: projectPath,
        });
        this.logger.info(`[Tier 2] 发现已有 opencode 服务: ${baseUrl}`);
        return this.client;
      }
    }

    this.logger.info("[Tier 2] 未发现已有 opencode 服务");
    return null;
  }

  /**
   * 向指定端口发送 HTTP 请求，判断是否有 opencode 服务。
   * 使用 /session 端点 — opencode API 必定响应此路径。
   */
  private async probePort(port: number): Promise<boolean> {
    const url = `http://${DEFAULT_HOSTNAME}:${port}/session`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      });
      // 2xx/3xx/4xx 均说明端口上有 HTTP 服务
      // 排除 5xx 以避免连接到不健康的服务
      return response.status < 500;
    } catch {
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ─── Tier 3: 自启动回退 ───────────────────────

  private async startNewServer(projectPath: string): Promise<OpencodeClient | null> {
    this.logger.info("[Tier 3] 尝试自启动 opencode 服务...");

    for (const port of CANDIDATE_PORTS) {
      try {
        this.logger.info(`[Tier 3] 尝试在端口 ${port} 启动...`);

        const server = await createOpencodeServer({
          hostname: DEFAULT_HOSTNAME,
          port,
          timeout: SERVER_START_TIMEOUT_MS,
        });

        this.managedServer = server;
        this.client = createOpencodeClient({
          baseUrl: server.url,
          directory: projectPath,
        });
        this.logger.info(`[Tier 3] 成功启动 opencode 服务: ${server.url}`);
        return this.client;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // 截断 server output 中可能的超长日志
        const shortMessage = message.length > 200
          ? message.slice(0, 200) + "..."
          : message;
        this.logger.warn(`[Tier 3] 端口 ${port} 启动失败: ${shortMessage}`);
      }
    }

    this.logger.error("[Tier 3] 所有候选端口均启动失败");
    return null;
  }
}
