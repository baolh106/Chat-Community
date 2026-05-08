import type { IUnitOfWork } from "./IUnitOfWork";
import { SurrealDbContext } from "../config/database/surrealDBContext";

/**
 * UnitOfWork cho SurrealDB
 * SurrealDB hỗ trợ transaction thông qua BEGIN/COMMIT/ROLLBACK
 */
export class UnitOfWorkSurreal implements IUnitOfWork {
  constructor(private readonly dbContext: SurrealDbContext) {}

  /**
   * Chạy logic trong transaction
   * @param work Hàm callback chứa logic nghiệp vụ
   */
  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    const db = this.dbContext.getConnection();
    // Bắt đầu transaction
    await db.query("BEGIN TRANSACTION");

    try {
      // Lưu transaction instance vào AsyncLocalStorage
      // Trong SurrealDB, transaction được quản lý qua connection
      // Nên ta dùng chính connection đó
      const result = await SurrealDbContext.transactionStorage.run(
        db,
        async () => {
          return await work();
        },
      );

      // Commit transaction
      await db.query("COMMIT TRANSACTION");
      return result;
    } catch (error) {
      // Rollback transaction
      await db.query("ROLLBACK TRANSACTION");
      throw error;
    }
  }
}
