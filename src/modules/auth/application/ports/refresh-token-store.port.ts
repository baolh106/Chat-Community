export interface IRefreshTokenStore {
  save(principalId: string, token: string, ttlSeconds: number): Promise<void>;
  get(principalId: string): Promise<string | null>;
  revoke(principalId: string): Promise<void>;
}
