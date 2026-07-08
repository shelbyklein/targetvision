/**
 * Minimal promise concurrency limiter (p-limit style, no dependency).
 *
 * Background photo jobs (AI analysis, thumbnail generation) are fired off
 * per-upload without awaiting. Each holds the full image in memory, so an
 * unbounded pile-up during bulk uploads exhausts the V8 heap and crashes
 * the process. Wrapping them in a limiter bounds peak memory to a handful
 * of images regardless of upload rate.
 */
export function createLimiter(maxConcurrent: number) {
  let active = 0;
  const waiting: Array<() => void> = [];

  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= maxConcurrent) {
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      active--;
      waiting.shift()?.();
    }
  };
}
