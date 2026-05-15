import type { SurrealDbContext } from "../../../config/database/surrealDBContext";
import type { IEventBus } from "../../../infrastructure/event-bus/application/event-bus.interface";
import { AuthAPI } from "../api/auth";
import { AuthApplication } from "../application/auth.application";
import { AdminInfrastructure } from "../infrastructure/admin.infra";
import { JwtAuthService } from "../infrastructure/jwt-auth.service";

export const authModule = (pool: SurrealDbContext, eventBus: IEventBus) => {
  const infra = new AdminInfrastructure(pool);
  const jwtAuthService = new JwtAuthService();
  const authApp = new AuthApplication(infra, jwtAuthService, eventBus);
  const authApi = new AuthAPI(authApp);
  return {
    authApi,
    authApp,
  };
};
