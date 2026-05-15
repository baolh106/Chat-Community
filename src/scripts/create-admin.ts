import "dotenv/config";
import argon2 from "argon2";
import { Table } from "surrealdb";
import { connectDB } from "../shared/database/surrealDB.connect";
import { surrealConfig } from "../config/database/database";

async function main() {
  const password =
    process.env.ADMIN_PASSWORD?.trim() || process.argv[2]?.trim();

  if (!password) {
    console.error(
      "Usage: npm run create-admin -- <password> OR set ADMIN_PASSWORD in .env",
    );
    process.exit(1);
  }

  const db = await connectDB(surrealConfig);

  try {
    const hashedPassword = await argon2.hash(password);
    await db
      .insert(new Table("admin"), [{ password: hashedPassword }])
      .output("none");

    console.log("✅ Admin record created successfully.");
  } finally {
    await db.close?.();
  }
}

main().catch((error) => {
  console.error("Failed to create admin record:", error);
  process.exit(1);
});
