import { createLogger } from "../logging/logger";

const logger = createLogger("retry");
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    
    logger.warn("operation failed, retrying", { err: error, delayMs: delay, remainingRetries: retries });
    await new Promise((resolve) => setTimeout(resolve, delay));
    
    return withRetry(fn, retries - 1, delay * 1.5);
  }
}