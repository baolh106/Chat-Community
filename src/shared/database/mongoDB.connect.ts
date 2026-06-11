import { MongoClient, ServerApiVersion } from "mongodb";
import dns from "node:dns";
import { withRetry } from "../utils/retry";
import type { MongoDBConfig } from "../../config/database/database";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

function buildConnectionString(config: MongoDBConfig): string {
  const { protocol, cluster, username, password, dbName } = config;

  if (cluster.startsWith("mongodb://") || cluster.startsWith("mongodb+srv://")) {
    return cluster;
  }

  const auth = username && password 
    ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` 
    : "";

  return `${protocol}://${auth}${cluster}/${dbName}?retryWrites=true&w=majority`;
}

export async function connectMongoClient(config: MongoDBConfig): Promise<MongoClient> {
  const uri = buildConnectionString(config);
  
  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    connectTimeoutMS: 30000, // Tăng thời gian chờ kết nối lên 30s
    serverSelectionTimeoutMS: 30000,
  });

  return withRetry(async () => {
    await client.connect();
    // Ping thử để chắc chắn kết nối khả dụng
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Connected to MongoDB Atlas successfully!");
    return client;
  }, 5, 2000);
}
