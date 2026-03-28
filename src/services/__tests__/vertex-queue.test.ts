import { describe, it, expect, vi, afterEach } from "vitest";
import { VertexHttpError } from "@/lib/vertexErrors";
import {
  processWithQueue,
  isRetryableQuotaError,
  type QueueItem,
} from "../vertex-queue";

describe("isRetryableQuotaError", () => {
  it("detects VertexHttpError 429 and 503", () => {
    expect(isRetryableQuotaError(new VertexHttpError(429, "Too Many"))).toBe(
      true
    );
    expect(isRetryableQuotaError(new VertexHttpError(503, "Unavailable"))).toBe(
      true
    );
    expect(isRetryableQuotaError(new VertexHttpError(400, "Bad"))).toBe(false);
  });

  it("matches common message patterns", () => {
    expect(isRetryableQuotaError(new Error("HTTP 429"))).toBe(true);
    expect(isRetryableQuotaError(new Error("RESOURCE_EXHAUSTED"))).toBe(true);
    expect(isRetryableQuotaError(new Error("something else"))).toBe(false);
  });
});

describe("processWithQueue", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns results in input order", async () => {
    const items: QueueItem<number>[] = [0, 1, 2].map((id) => ({
      id,
      fn: async () => id * 10,
    }));
    const out = await processWithQueue(items, {
      concurrency: 2,
      requestTimeout: 5000,
      retries: 0,
      jitter: false,
      baseDelay: 1,
      maxDelay: 2,
    });
    expect(out.map((r) => r.success)).toEqual([true, true, true]);
    expect(out.map((r) => r.data)).toEqual([0, 10, 20]);
  });

  it("caps parallel in-flight work", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items: QueueItem<number>[] = Array.from({ length: 8 }, (_, id) => ({
      id,
      fn: async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 15));
        inFlight--;
        return id;
      },
    }));
    await processWithQueue(items, {
      concurrency: 2,
      requestTimeout: 10_000,
      retries: 0,
      jitter: false,
      baseDelay: 1,
      maxDelay: 2,
    });
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it("retries retryable errors then succeeds", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const items: QueueItem<string>[] = [
      {
        id: "a",
        fn: async () => {
          calls++;
          if (calls === 1) {
            throw new VertexHttpError(429, "quota");
          }
          return "ok";
        },
      },
    ];
    const p = processWithQueue(items, {
      concurrency: 1,
      requestTimeout: 5000,
      retries: 2,
      baseDelay: 10,
      maxDelay: 20,
      jitter: false,
    });
    await vi.advanceTimersByTimeAsync(5);
    await vi.advanceTimersByTimeAsync(30);
    const out = await p;
    expect(out[0]?.success).toBe(true);
    expect(out[0]?.data).toBe("ok");
    expect(calls).toBe(2);
  });
});
