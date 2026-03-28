/**
 * Concurrency-limited queue for Vertex (or similar) HTTP-heavy work.
 * Caps parallel in-flight requests, optional per-item timeout, 429/503 retries with jitter.
 */
import { VertexHttpError } from "@/lib/vertexErrors";

export interface QueueOptions {
  concurrency: number;
  requestTimeout: number;
  retries: number;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
  onProgress?: (completed: number, total: number, failed: number) => void;
}

export interface QueueItem<T> {
  id: string | number;
  fn: () => Promise<T>;
}

export interface QueueResult<T> {
  id: string | number;
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
}

/** True for Vertex 429/503 and matching message patterns (for callers that catch/rethrow). */
export function isRetryableQuotaError(err: unknown): boolean {
  if (err instanceof VertexHttpError) {
    return err.status === 429 || err.status === 503;
  }
  const m = err instanceof Error ? err.message : String(err);
  return /429|RESOURCE_EXHAUSTED|503|Too Many Requests/i.test(m);
}

function computeDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  jitter: boolean
): number {
  const base = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  if (!jitter) return base;
  return base * (0.8 + Math.random() * 0.4);
}

async function runItem<T>(
  item: QueueItem<T>,
  opts: QueueOptions
): Promise<QueueResult<T>> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      const data = await Promise.race([
        item.fn(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(`Request timeout after ${opts.requestTimeout}ms`)
              ),
            opts.requestTimeout
          )
        ),
      ]);
      return { id: item.id, success: true, data, attempts: attempt + 1 };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const retry = isRetryableQuotaError(err) && attempt < opts.retries;
      if (!retry) {
        return {
          id: item.id,
          success: false,
          error: lastError,
          attempts: attempt + 1,
        };
      }
      const delayMs = computeDelay(
        attempt,
        opts.baseDelay,
        opts.maxDelay,
        opts.jitter
      );
      console.warn(
        `[VertexQueue] retryable error on item ${String(item.id)} attempt ${attempt + 1}/${opts.retries + 1} in ${Math.round(delayMs)}ms:`,
        lastError.message
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return {
    id: item.id,
    success: false,
    error: lastError,
    attempts: opts.retries + 1,
  };
}

/**
 * Process queue items with at most `concurrency` parallel executions.
 */
export async function processWithQueue<T>(
  items: QueueItem<T>[],
  options: Partial<QueueOptions> = {}
): Promise<QueueResult<T>[]> {
  const opts: QueueOptions = {
    concurrency: 3,
    requestTimeout: 45_000,
    retries: 4,
    baseDelay: 2_000,
    maxDelay: 30_000,
    jitter: true,
    ...options,
  };

  if (items.length === 0) return [];

  const results: QueueResult<T>[] = new Array(items.length);

  let completed = 0;
  let failed = 0;
  let next = 0;
  let active = 0;

  return new Promise((resolve) => {
    const checkDone = () => {
      if (completed === items.length) {
        resolve(results);
      }
    };

    const schedule = () => {
      while (active < opts.concurrency && next < items.length) {
        const item = items[next]!;
        const slot = next++;
        active++;
        void runItem(item, opts).then((result) => {
          results[slot] = result;
          completed++;
          if (!result.success) failed++;
          active--;
          opts.onProgress?.(completed, items.length, failed);
          checkDone();
          schedule();
        });
      }
    };

    schedule();
  });
}
