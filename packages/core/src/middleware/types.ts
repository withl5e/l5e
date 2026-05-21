import type { RequestInfo } from '../core/entry-server';

export type RewritePayload = string | URL | Request;

export type MiddlewareNext = (payload?: RewritePayload) => Promise<Response>;

export interface CreateContext {
  request: Request;
  requestInfo?: RequestInfo;
  locals?: Record<string, unknown>;
  clientAddress?: string | null;
}

export interface MiddlewareContext {
  request: Request;
  requestInfo?: RequestInfo;
  url: URL;
  cookies: Record<string, string>;
  locals: Record<string, unknown>;
  redirect: (path: string | URL, status?: number) => Response;
  rewrite: (payload: RewritePayload) => Promise<Response>;
  clientAddress: string;
}

export type MiddlewareHandler = (
  context: MiddlewareContext,
  next: MiddlewareNext,
) => Response | Promise<Response>;
