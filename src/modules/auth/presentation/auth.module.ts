import type { IDbExecutor } from "../../../shared/database/db-executor.interface";
import type { IEventBus } from "../../../infrastructure/event-bus/application/event-bus.interface";
import { AuthAPI } from "../api/auth";
import { AuthApplication } from "../application/auth.application";
// import { AdminInfrastructure } from "../infrastructure/surreal/admin.infra";
import { JwtAuthService } from "../infrastructure/jwt-auth.service";
import { AdminInfrastructure } from "../infrastructure/mongo/admin.infra";

export const authModule = (dbExecutor: IDbExecutor, eventBus: IEventBus) => {
  const infra = new AdminInfrastructure(dbExecutor);
  const jwtAuthService = new JwtAuthService();
  const authApp = new AuthApplication(infra, jwtAuthService, eventBus);
  const authApi = new AuthAPI(authApp);
  return {
    authApi,
    authApp,
  };
};
