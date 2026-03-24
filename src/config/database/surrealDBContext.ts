import type { Surreal } from "surrealdb";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * SurrealDB Context - Tương tự MssqlDbContext nhưng cho SurrealDB
 * Hỗ trợ transaction thông qua AsyncLocalStorage
 */
export class SurrealDbContext {
  static transactionStorage = new AsyncLocalStorage<Surreal>();

  constructor(private readonly db: Surreal) {}

  /**
   * Lấy SurrealDB instance
   * Nếu đang trong transaction, trả về transaction instance
   * Nếu không, trả về connection chính
   */
  public getDB(): Surreal {
    const currentTransaction = SurrealDbContext.transactionStorage.getStore();
    if (currentTransaction) {
      return currentTransaction;
    }
    return this.db;
  }

  /**
   * Lấy connection chính (không phải transaction)
   */
  public getConnection(): Surreal {
    return this.db;
  }
}
