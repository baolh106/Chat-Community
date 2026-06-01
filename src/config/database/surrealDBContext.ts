import type { Surreal } from "surrealdb";
import { AsyncLocalStorage } from "node:async_hooks";
import type { SurrealDBConfig } from "./database";
import type { IDbExecutor } from "../../shared/database/db-executor.interface";

/**
 * SurrealDB Context - Tương tự MssqlDbContext nhưng cho SurrealDB
 * Hỗ trợ transaction thông qua AsyncLocalStorage
 */
export class SurrealDbContext implements IDbExecutor {
  static transactionStorage = new AsyncLocalStorage<Surreal>();
  private reauthPromise: Promise<void> | null = null;

  constructor(
    private readonly db: Surreal,
    private readonly config?: SurrealDBConfig,
  ) {}

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

  private isSessionExpiredError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
      return false;
    }

    const maybeError = error as any;
    const message = String(maybeError.message ?? "").toLowerCase();
    const kind = maybeError?.details?.details?.kind;

    return (
      message.includes("session expired") ||
      message.includes("sessionhasexpired") ||
      kind === "SessionExpired"
    );
  }

  private async reauthenticate(db: Surreal): Promise<void> {
    if (this.reauthPromise) return this.reauthPromise;

    this.reauthPromise = (async () => {
      try {
        if (!this.config?.username || !this.config?.password) {
          return;
        }

        await db.signin({
          username: this.config.username,
          password: this.config.password,
        });

        await db.use({
          namespace: this.config.namespace,
          database: this.config.database,
        });
      } finally {
        this.reauthPromise = null;
      }
    })();

    return this.reauthPromise;
  }

  public async execute<T>(work: (db: Surreal) => Promise<T>): Promise<T> {
    const db = this.getDB();
    try {
      return await work(db);
    } catch (error) {
      if (!this.isSessionExpiredError(error)) {
        throw error;
      }

      await this.reauthenticate(db);
      return await work(db);
    }
  }
}
