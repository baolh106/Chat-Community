import { Surreal } from "surrealdb";

export interface SurrealDBConfig {
  url: string;
  namespace: string;
  database: string;
  username?: string;
  password?: string;
}

export async function connectDB(config: SurrealDBConfig): Promise<Surreal> {
  try {
    const db = new Surreal();
    // Connect to SurrealDB với namespace và database
    await db.connect(config.url, {
      namespace: config.namespace,
      database: config.database,
    });

    // Sign in nếu có auth credentials
    if (config.username && config.password) {
      await db.signin({
        username: config.username,
        password: config.password,
      });
    }

    console.log("✅ Connected to SurrealDB successfully!");

    return db;
  } catch (err) {
    console.error("❌ SurrealDB connection failed!", err);
    throw err;
  }
}
