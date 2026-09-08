import type { ServiceLogger } from './logger.cjs';

export interface RouteExtra {
  requestId: string;
  log: ServiceLogger;
}
export type RouteHandler<Context> = (
  request: Request,
  context: Context,
  extra: RouteExtra
) => Promise<Response> | Response;
export function route<Context = { params: Promise<Record<string, string>> }>(
  method: string,
  handler: RouteHandler<Context>
): (request: Request, context: Context) => Promise<Response>;
export function clientIp(request: Request): string;
