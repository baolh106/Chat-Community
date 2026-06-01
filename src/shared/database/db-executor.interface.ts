import type { Surreal } from "surrealdb";

export interface IDbExecutor {
  execute<T>(work: (db: Surreal) => Promise<T>): Promise<T>;
}
