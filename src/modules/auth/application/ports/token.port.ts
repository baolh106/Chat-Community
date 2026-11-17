import type {
  AuthClaims,
  ITokenVerifier,
} from "../../../../shared/auth/auth-claims";
import type { TokenResponse } from "../dtos/user-session.dto";

export interface ITokenService extends ITokenVerifier {
  issue(claims: AuthClaims): TokenResponse;
  refreshTokenTtlSeconds(): number;
}
