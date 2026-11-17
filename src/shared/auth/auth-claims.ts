
export const ADMIN_PRINCIPAL = "admin" as const;

export type AuthRole = "admin" | "user";

export type TokenType = "access" | "refresh";

export type AuthClaims = {
  role: AuthRole;
  userId?: string;
  nickname?: string;
};

export type TokenVerifyResult =
  | { ok: true; claims: AuthClaims }
  | { ok: false; reason: "expired" | "invalid" };

export interface ITokenVerifier {
  verify(token: string, expectedType: TokenType): TokenVerifyResult;
}

export function principalIdOf(claims: AuthClaims): string | undefined {
  return claims.role === "admin" ? ADMIN_PRINCIPAL : claims.userId;
}

export function isAllowedReceiver(role: AuthRole, receiver: string): boolean {
  if (role === "admin") {
    return receiver.length > 0 && receiver !== ADMIN_PRINCIPAL;
  }
  return receiver === ADMIN_PRINCIPAL;
}

export function canAccessConversation(
  claims: AuthClaims,
  conversationKey: string,
): boolean {
  if (claims.role === "admin") return true;
  return Boolean(claims.userId) && claims.userId === conversationKey;
}

export function normalizeBearerToken(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const stripped = raw.trim().replace(/^bearer(\s+|$)/i, "").trim();
  return stripped.length > 0 ? stripped : undefined;
}
