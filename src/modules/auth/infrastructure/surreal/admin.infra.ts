import argon2 from "argon2";
import { Table } from "surrealdb";
import type { IDbExecutor } from "../../../../shared/database/db-executor.interface";
import type { IAdminInfrastructure } from "../../domain/admin.infra";

export class AdminInfrastructure implements IAdminInfrastructure {
  constructor(private readonly pool: IDbExecutor) {}

  async verifyPassword(password: string): Promise<boolean> {
    const result = await this.pool.execute(async (db) => {
      return await db
        .select(new Table("admin"))
        .value("password");
    });

    const passwordHash = (result[0] as any) || "";
    return await this.comparePassword(password, passwordHash);
  }

  async comparePassword(
    password: string,
    passwordHash: string,
  ): Promise<boolean> {
    return await argon2.verify(passwordHash, password);
  }
}
