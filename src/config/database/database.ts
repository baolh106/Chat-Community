// SurrealDB configuration interface and object
export interface SurrealDBConfig {
  url: string;
  namespace: string;
  database: string;
  username?: string;
  password?: string;
}

export const surrealConfig: SurrealDBConfig = {
  url: process.env.SURREAL_URL as string,
  namespace: process.env.SURREAL_NAMESPACE as string,
  database: process.env.SURREAL_DATABASE as string,
  username: process.env.SURREAL_USERNAME as string,
  password: process.env.SURREAL_PASSWORD as string,
};

// MongoDB configuration interface and object
export interface MongoDBConfig {
  protocol: string;
  cluster: string;
  dbName: string;
  username?: string;
  password?: string;
}

export const mongoConfig: MongoDBConfig = {
  protocol: process.env.MONGO_PROTOCOL || "mongodb+srv",
  cluster: (process.env.MONGO_CLUSTER || "localhost") as string,
  dbName: process.env.MONGO_DB_NAME as string,
  username: (process.env.MONGO_USERNAME || "") as string,
  password: (process.env.MONGO_PASSWORD || "") as string,
};