import argon2 from "argon2";
import { Table } from "surrealdb";
import type { SurrealDbContext } from "../../../config/database/surrealDBContext";
import type { TAdmin } from "../domain/dtos/admin.dto";

export class AdminInfrastructure {
  constructor(private readonly pool: SurrealDbContext) {}

  async verifyPassword(password: string): Promise<boolean> {
    const result = await this.pool
      .getDB()
      .select<TAdmin>(new Table("admin"))
      .value("password");

    console.log("result", result);
    const passwordAdmin = result[0]?.password || "";
    return await this.comparePassword(passwordAdmin, password);
  }

  async comparePassword(
    password: string,
    passwordHash: string,
  ): Promise<boolean> {
    return await argon2.verify(passwordHash, password);
  }
}
