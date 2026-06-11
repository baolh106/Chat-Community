import argon2 from "argon2";
import { Db } from "mongodb";
import type { IDbExecutor } from "../../../../shared/database/db-executor.interface";
import type { IAdminInfrastructure } from "../../domain/admin.infra";

export class AdminInfrastructure implements IAdminInfrastructure {
  constructor(private readonly pool: IDbExecutor<Db>) {}

  async verifyPassword(password: string): Promise<boolean> {
    const adminDoc = await this.pool.execute(async (db) => {
      return await db.collection("admin").findOne({});
    });

    if (!adminDoc || !adminDoc.password) {
      return false;
    }

    const passwordHash = adminDoc.password as string;
    return await this.comparePassword(password, passwordHash);
  }

  async comparePassword(
    password: string,
    passwordHash: string,
  ): Promise<boolean> {
    return await argon2.verify(passwordHash, password);
  }
}
