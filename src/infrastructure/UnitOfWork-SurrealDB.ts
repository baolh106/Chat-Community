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
    return await this.dbContext.execute(async (db) => {
      let isTransactionActive = false;
      try {
        // Bắt đầu transaction bên trong try block
        await db.query("BEGIN TRANSACTION");
        isTransactionActive = true;

        const result = await SurrealDbContext.transactionStorage.run(
          db,
          async () => {
            return await work();
          },
        );

        // Commit transaction và đánh dấu kết thúc
        if (isTransactionActive) {
          await db.query("COMMIT TRANSACTION").catch((err) => {
            if (!String(err).includes("without starting a transaction")) throw err;
          });
          isTransactionActive = false;
        }
        return result;
      } catch (error) {
        if (isTransactionActive) {
          // Chỉ gọi CANCEL nếu transaction thực sự đã được mở thành công
          // Dùng .catch(() => {}) để nuốt lỗi nếu DB đã tự động rollback trước đó
          await db.query("CANCEL TRANSACTION").catch(() => {});
        }
        throw error;
      }
    });
  }
}
