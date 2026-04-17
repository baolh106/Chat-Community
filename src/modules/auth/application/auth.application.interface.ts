import type {
  TokenResponse,
  UserSessionStartRequest,
} from "./dtos/user-session.dto";

export interface IAuthApplication {
  startUserSession(req: UserSessionStartRequest): Promise<TokenResponse>;
  endUserSession(userId: string): Promise<void>;
  loginAdmin(password: string): Promise<TokenResponse>;
}
