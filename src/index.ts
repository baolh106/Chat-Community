import "./config/env";

import { surrealConfig } from "./config/database/database";
import { SurrealDbContext } from "./config/database/surrealDBContext";
import { connectDB } from "./shared/database/surrealDB.connect";
import { App } from "./shared/server/server";
import { port } from "./config/env";
import { UnitOfWorkSurreal } from "./infrastructure/UnitOfWork-SurrealDB";
import { messageModule } from "./modules/message/presentation/message.module";

async function main() {
  const app = new App();
  app.addPrefix("/api");

  // Connect DB
  const db = await connectDB(surrealConfig);
  const dbContext = new SurrealDbContext(db);
  const uow = new UnitOfWorkSurreal(dbContext);

  // Message Router
  // API Routes
  app.addRouter(messageModule(dbContext, uow).messageApi.api(), "/message");

  app.start(Number(port));
}

main();
