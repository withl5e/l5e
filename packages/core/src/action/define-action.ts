import type { ActionOptions, Action } from './types';

export function defineAction(opts: ActionOptions): Action {
  return {
    handler: opts.handler,
    method: opts.method ?? 'GET',
  } as Action;
}
