// ============================================
// core/circuit-breaker.ts — 熔断器
// ============================================

const MAX_RETRIES = 3;

export interface CircuitBreakerResult {
  shouldRetry: boolean;
  currentCount: number;
  maxCount: number;
  action: "RETRY" | "STOP_AND_REPORT";
}

export class CircuitBreaker {
  /** 同一代理、同一问题的重试追踪 */
  private retryMap: Map<string, number> = new Map();

  /**
   * 记录一次失败并返回决策
   * @param agentName 代理名称
   * @param errorFingerprint 错误指纹（用于区分"同一问题"）
   */
  recordFailure(
    agentName: string,
    errorFingerprint: string,
  ): CircuitBreakerResult {
    const key = `${agentName}::${errorFingerprint}`;
    const current = this.retryMap.get(key) ?? 0;
    const next = current + 1;
    this.retryMap.set(key, next);

    if (next >= MAX_RETRIES) {
      return {
        shouldRetry: false,
        currentCount: next,
        maxCount: MAX_RETRIES,
        action: "STOP_AND_REPORT",
      };
    }

    return {
      shouldRetry: true,
      currentCount: next,
      maxCount: MAX_RETRIES,
      action: "RETRY",
    };
  }

  /** 阶段成功后重置该代理的计数 */
  reset(agentName: string): void {
    for (const key of this.retryMap.keys()) {
      if (key.startsWith(`${agentName}::`)) {
        this.retryMap.delete(key);
      }
    }
  }

  /** 获取指定代理的当前重试次数 */
  getRetryCount(agentName: string, errorFingerprint: string): number {
    const key = `${agentName}::${errorFingerprint}`;
    return this.retryMap.get(key) ?? 0;
  }

  /** 重置所有计数 */
  resetAll(): void {
    this.retryMap.clear();
  }
}
