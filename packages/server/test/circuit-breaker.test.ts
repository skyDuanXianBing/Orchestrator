import { describe, expect, it } from "vitest";
import { CircuitBreaker } from "../src/core/circuit-breaker.js";

describe("CircuitBreaker", () => {
  it("should stop after max retries", () => {
    const breaker = new CircuitBreaker();

    const first = breaker.recordFailure("impl_green_coder", "same-error");
    const second = breaker.recordFailure("impl_green_coder", "same-error");
    const third = breaker.recordFailure("impl_green_coder", "same-error");

    expect(first.shouldRetry).toBe(true);
    expect(second.shouldRetry).toBe(true);
    expect(third.shouldRetry).toBe(false);
    expect(third.action).toBe("STOP_AND_REPORT");
  });

  it("should reset retry count by agent", () => {
    const breaker = new CircuitBreaker();
    breaker.recordFailure("impl_green_coder", "err");
    breaker.reset("impl_green_coder");

    const count = breaker.getRetryCount("impl_green_coder", "err");
    expect(count).toBe(0);
  });
});
