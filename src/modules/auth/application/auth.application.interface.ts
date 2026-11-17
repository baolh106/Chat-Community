import type { AuthClaims } from "../../../shared/auth/auth-claims";
import type {
  TokenResponse,
  UserSessionStartRequest,
} from "./dtos/user-session.dto";

export interface IAuthApplication {
  startUserSession(req: UserSessionStartRequest): Promise<TokenResponse>;
  endUserSession(claims: AuthClaims): Promise<void>;
  loginAdmin(password: string, clientKey: string): Promise<TokenResponse>;
  refreshToken(refreshToken: string): Promise<TokenResponse>;
}
