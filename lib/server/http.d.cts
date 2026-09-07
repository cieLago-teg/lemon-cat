import type { ServiceLogger } from './logger.cjs';

export interface RouteExtra {
  requestId: string;
  log: ServiceLogger;
}
export type RouteHandler = (
  request: Request,
  context: any,
  extra: RouteExtra
) => Promise<Response> | Response;
export function route(
  method: string,
  handler: RouteHandler
): (request: Request, context?: any) => Promise<Response>;
export function clientIp(request: Request): string;
