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
