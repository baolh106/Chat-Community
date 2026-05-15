import argon2 from "argon2";
import { Table } from "surrealdb";
import type { SurrealDbContext } from "../../../config/database/surrealDBContext";
import type { TAdmin } from "../domain/dtos/admin.dto";

export class AdminInfrastructure {
  constructor(private readonly pool: SurrealDbContext) {}

  async verifyPassword(password: string): Promise<boolean> {
    const result = await this.pool
      .getDB()
      .select(new Table("admin"))
      .value("password");

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
