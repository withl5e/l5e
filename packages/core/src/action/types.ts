import type { RequestInfo } from '../core/entry-server';
import type { JSXChild, RenderedNode } from '../core/jsx-runtime';

type ActionReturn = JSXChild | RenderedNode;

export interface ActionOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  handler: (req: RequestInfo) => ActionReturn | Promise<ActionReturn>;
}

/**
 * Action is both a server-side object (with handler/method) and
 * a callable function on the client (after Vite transform replaces it with a fetch stub).
 * The call signature matches what the client sees after transform.
 */
export interface Action {
  handler: (req: RequestInfo) => ActionReturn | Promise<ActionReturn>;
  method: string;
  // Client-side call signature (Vite transform replaces Action with an async function)
  (params?: Record<string, any>): Promise<Response>;
}
