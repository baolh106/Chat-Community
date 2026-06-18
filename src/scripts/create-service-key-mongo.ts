import "dotenv/config";
import { randomUUID, randomBytes } from "node:crypto";
import { mongoConfig } from "../config/database/database";
import { connectMongoClient } from "../shared/database/mongoDB.connect";

async function main() {
  const serviceName = process.argv[2]?.trim();
  const description = process.argv[3]?.trim() || null;

  if (!serviceName) {
    console.error(
      "Sử dụng: npx tsx src/scripts/create-service-key-mongo.ts <service_name> [description]"
    );
    process.exit(1);
  }

  let client;
  try {
    client = await connectMongoClient(mongoConfig);
    const db = client.db(mongoConfig.dbName);
    const collection = db.collection("service_keys");

    // Tạo một key ngẫu nhiên an toàn (64 ký tự hex)
    const generatedKey = randomBytes(32).toString("hex");
    
    const serviceKeyDoc = {
      _id: randomUUID() as any,
      service_name: serviceName,
      key: generatedKey,
      is_active: true,
      description: description,
      createdAt: new Date()
    };

    await collection.insertOne(serviceKeyDoc);

    console.log("✅ Service key created successfully in MongoDB.");
    console.log("--------------------------------------------------");
    console.log(`Service Name : ${serviceName}`);
    console.log(`Generated Key: ${generatedKey}`);
    console.log(`Active       : true`);
    if (description) {
      console.log(`Description  : ${description}`);
    }
    console.log("--------------------------------------------------");
    console.log("⚠️  Hãy lưu lại key này vì nó sẽ không được hiển thị lại lần nữa.");
  } catch (error) {
    console.error("Failed to create service key in MongoDB:", error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

main();