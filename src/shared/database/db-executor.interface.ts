export interface IDbExecutor<TDb = any> {
  execute<T>(work: (db: TDb) => Promise<T>): Promise<T>;
}
