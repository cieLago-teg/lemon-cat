export interface ServiceConfig {
  databaseUrl: string | undefined;
  dataDir: string;
  origin: string;
  production: boolean;
  provider: string;
  storage: string;
  invite: string | undefined;
  initialCredits: number;
}
export function config(): ServiceConfig;
