import { MongoClient, Db, ClientSession } from "mongodb";
import { AsyncLocalStorage } from "node:async_hooks";
import type { MongoDBConfig } from "./database";
import type { IDbExecutor } from "../../shared/database/db-executor.interface";

/**
 * MongoDB Context hỗ trợ quản lý transaction qua AsyncLocalStorage
 */
export class MongoDbContext implements IDbExecutor<Db> {
  static transactionStorage = new AsyncLocalStorage<ClientSession>();
  private reauthPromise: Promise<void> | null = null;
  private readonly db: Db;

  constructor(
    private readonly client: MongoClient,
    private readonly config: MongoDBConfig
  ) {
    // Khởi tạo instance Db một lần duy nhất
    this.db = this.client.db(this.config.dbName);
  }

  /**
   * Lấy Database instance
   */
  public getDb(): Db {
    // Trả về instance Db chính. 
    return this.db;
  }

  /**
   * Lấy connection chính (MongoClient)
   */
  public getConnection(): MongoClient {
    return this.client;
  }

  /**
   * Helper static để lấy session hiện tại từ context mà không cần instance
   */
  public static get currentSession(): ClientSession | undefined {
    return this.transactionStorage.getStore();
  }

  private isConnectionError(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;

    const message = String((error as any).message ?? "").toLowerCase();
    return (
      message.includes("topology is closed") ||
      message.includes("not connected") ||
      message.includes("pool is closed") ||
      message.includes("connection closed")
    );
  }

  private async reauthenticate(): Promise<void> {
    if (this.reauthPromise) return this.reauthPromise;

    this.reauthPromise = (async () => {
      try {
        await this.client.connect();
        // Ping để kiểm tra trạng thái kết nối
        await this.client.db("admin").command({ ping: 1 });
      } finally {
        this.reauthPromise = null;
      }
    })();

    return this.reauthPromise;
  }

  /**
   * Thực thi logic với DB
   */
  public async execute<T>(work: (db: Db) => Promise<T>): Promise<T> {
    const db = this.getDb();
    try {
      return await work(db);
    } catch (error) {
      if (!this.isConnectionError(error)) throw error;

      await this.reauthenticate();
      return await work(db);
    }
  }
}