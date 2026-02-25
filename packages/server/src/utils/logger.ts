// ============================================
// utils/logger.ts — 结构化日志
// ============================================

export class Logger {
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  info(message: string, ...args: unknown[]): void {
    console.log(`[${this.formatTimestamp()}] [INFO] ${message}`, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(`[${this.formatTimestamp()}] [WARN] ${message}`, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(`[${this.formatTimestamp()}] [ERROR] ${message}`, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    if (process.env.DEBUG === "true") {
      console.debug(`[${this.formatTimestamp()}] [DEBUG] ${message}`, ...args);
    }
  }

  /** 打印流水线状态块 */
  printPipelineStatus(
    taskId: string,
    currentPhaseId: string,
    currentIndex: number,
    totalPhases: number,
    description: string,
  ): void {
    console.log("\n┌──────────────────────────────────────────────────────┐");
    console.log(`│ 🔄 Pipeline: ${taskId}`);
    console.log(`│ Phase ${currentIndex + 1}/${totalPhases}: [${currentPhaseId}] ${description}`);
    console.log("└──────────────────────────────────────────────────────┘");
  }
}
