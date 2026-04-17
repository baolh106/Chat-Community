import type { SurrealDbContext } from "../../../config/database/surrealDBContext";
import { AuthAPI } from "../api/auth";
import { AuthApplication } from "../application/auth.application";
import { AdminInfrastructure } from "../infrastructure/admin.infra";
import { JwtAuthService } from "../infrastructure/jwt-auth.service";

export const authModule = (pool: SurrealDbContext) => {
  const infra = new AdminInfrastructure(pool);
  const jwtAuthService = new JwtAuthService();
  const authApp = new AuthApplication(infra, jwtAuthService);
  const authApi = new AuthAPI(authApp);
  return {
    authApi,
    authApp,
  };
};
