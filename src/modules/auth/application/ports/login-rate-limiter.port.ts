export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export interface ILoginRateLimiter {
  consume(key: string): Promise<RateLimitDecision>;
  reset(key: string): Promise<void>;
}
