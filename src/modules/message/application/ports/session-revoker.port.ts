export interface ISessionRevoker {
  revoke(userId: string): Promise<void>;
}
