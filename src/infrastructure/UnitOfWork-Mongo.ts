import { MongoClient, ClientSession } from "mongodb";
import type { IUnitOfWork } from "./IUnitOfWork";
import { MongoDbContext } from "../config/database/mongoDBContext";

/**
 * UnitOfWork cho MongoDB (hỗ trợ Replica Set/Atlas transactions)
 */
export class UnitOfWorkMongo implements IUnitOfWork {
  constructor(private readonly client: MongoClient) {}

  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    const session = this.client.startSession();
    try {
      // withTransaction tự động handle abort/commit và retry trên Atlas
      const result = await session.withTransaction(async () => {
        // Chạy logic nghiệp vụ trong context của session
        return await MongoDbContext.transactionStorage.run(session, work);
      });
      return result as T;
    } catch (error) {
      throw error;
    } finally {
      await session.endSession();
    }
  }
}