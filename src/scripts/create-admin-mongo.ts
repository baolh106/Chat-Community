import "dotenv/config";
import argon2 from "argon2";
import { mongoConfig } from "../config/database/database";
import { connectMongoClient } from "../shared/database/mongoDB.connect";
import { randomUUID } from "node:crypto";

async function main() {
  const password =
    process.env.ADMIN_PASSWORD?.trim() || process.argv[2]?.trim();

  if (!password) {
    console.error(
      "Usage: npx tsx src/scripts/create-admin-mongo.ts <password> OR set ADMIN_PASSWORD in .env",
    );
    process.exit(1);
  }

  let client;
  try {
    client = await connectMongoClient(mongoConfig);
    const db = client.db(mongoConfig.dbName);
    const collection = db.collection("admin");

    const hashedPassword = await argon2.hash(password);
    
    await collection.insertOne({
      _id: randomUUID() as any,
      password: hashedPassword,
      createdAt: new Date()
    });

    console.log("✅ Admin record created successfully in MongoDB.");
  } catch (error) {
    console.error("Failed to create admin record in MongoDB:", error);
    process.exit(1);
  } finally {
    if (client) await client.close();
  }
}

main();