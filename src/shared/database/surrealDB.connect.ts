import { Surreal } from "surrealdb";
import { withRetry } from "../utils/retry";
import type { SurrealDBConfig } from "../../config/database/database";
import { createLogger } from "../logging/logger";

const logger = createLogger("surrealdb");

export async function connectDB(config: SurrealDBConfig): Promise<Surreal> {
  const db = new Surreal();
  
  return withRetry(async () => {
    await db.connect(config.url, {
      namespace: config.namespace,
      database: config.database,
    });

    if (config.username && config.password) {
      await db.signin({
        username: config.username,
        password: config.password,
      });
    }

    logger.info("connected to surrealdb");
    return db;
  }, 5, 2000);
}
