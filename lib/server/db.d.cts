export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number | null;
}
export interface DbClient {
  query(text: string, params?: unknown[]): Promise<QueryResult>;
  release(): void;
}
export interface DbPool {
  query(text: string, params?: unknown[]): Promise<QueryResult>;
  connect(): Promise<DbClient>;
  end(): Promise<void>;
}
export function database(): DbPool;
export function transaction<T>(run: (client: DbClient) => Promise<T>): Promise<T>;
export function close(): Promise<void>;
