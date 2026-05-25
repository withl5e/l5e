import { parse, type Token } from 'path-to-regexp';

export type Specificity = readonly number[];

/**
 * Derives a sort tuple from a route path so `defineRoutes()` can order routes
 * deterministically: more specific patterns win regardless of declaration order.
 *
 * Tuple (compared descending — higher wins):
 *   [splatPenalty, groupPenalty, requiredSegments, staticSegments, -paramCount]
 *
 *   splatPenalty:    -1 if the path contains a wildcard (splat), else 0 → splat routes last
 *   groupPenalty:    -1 if the path contains an optional group, else 0  → required-only beats group-bearing at equal URL
 *   requiredSegments: count of `/`-separated pieces at the top level (static text + params + wildcards)
 *   staticSegments:  count of those pieces that are pure static text
 *   paramCount:      count of `:param` tokens at the top level (negated so fewer dynamics wins the tiebreak)
 */
export function pathSpecificity(path: string): Specificity {
  const td = parse(path);
  let splatPenalty = 0;
  let groupPenalty = 0;
  let staticSegments = 0;
  let paramCount = 0;
  let requiredSegments = 0;

  for (const tok of td.tokens) {
    if (tok.type === 'text') {
      const pieces = tok.value.split('/').filter((p) => p.length > 0);
      staticSegments += pieces.length;
      requiredSegments += pieces.length;
    } else if (tok.type === 'param') {
      paramCount++;
      requiredSegments++;
    } else if (tok.type === 'wildcard') {
      splatPenalty = -1;
      requiredSegments++;
    } else if (tok.type === 'group') {
      groupPenalty = -1;
      // Group contents do not count toward requiredSegments — they're optional.
    }
  }

  return Object.freeze([splatPenalty, groupPenalty, requiredSegments, staticSegments, -paramCount]);
}

export function compareSpecificity(a: Specificity, b: Specificity): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return b[i] - a[i];
  }
  return 0;
}
