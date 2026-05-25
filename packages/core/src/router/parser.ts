import { RoutePatternError, type Token } from './lexer';

export type Segment =
  | { kind: 'static'; value: string }
  | { kind: 'param'; name: string }
  | { kind: 'splat' };

export type RouteAst = {
  segments: Segment[];
  hasSplat: boolean;
  specificity: readonly number[];
};

export function parse(tokens: Token[], pattern: string): RouteAst {
  const segments: Segment[] = [];
  let hasSplat = false;
  const paramNames = new Set<string>();

  // State machine: after each token we are either "right after a Slash" (next thing
  // must be a segment-producing token or EOF) or "right after a segment" (next thing
  // must be a Slash or EOF). The lexer guarantees the first token is a Slash, so we
  // start in the "after segment" virtual state (equivalent to expecting a Slash).
  type State = 'AFTER_SLASH' | 'AFTER_SEGMENT';
  let state: State = 'AFTER_SEGMENT';

  for (const tok of tokens) {
    if (hasSplat) {
      throw new RoutePatternError(
        'Splat "$" must be the final segment',
        pattern,
        tok.column,
      );
    }

    if (tok.type === 'Slash') {
      if (state === 'AFTER_SLASH') {
        throw new RoutePatternError(
          'Empty segment (double "/")',
          pattern,
          tok.column,
        );
      }
      state = 'AFTER_SLASH';
      continue;
    }

    if (state !== 'AFTER_SLASH') {
      // Defensive — lexer guarantees a Slash separates segment tokens.
      throw new RoutePatternError(
        'Expected "/" between segments',
        pattern,
        tok.column,
      );
    }

    if (tok.type === 'Static') {
      segments.push({ kind: 'static', value: tok.value });
    } else if (tok.type === 'Param') {
      if (paramNames.has(tok.name)) {
        throw new RoutePatternError(
          `Duplicate param name "$${tok.name}"`,
          pattern,
          tok.column,
        );
      }
      paramNames.add(tok.name);
      segments.push({ kind: 'param', name: tok.name });
    } else {
      segments.push({ kind: 'splat' });
      hasSplat = true;
    }

    state = 'AFTER_SEGMENT';
  }

  return {
    segments,
    hasSplat,
    specificity: computeSpecificity(segments, hasSplat),
  };
}

function computeSpecificity(segments: Segment[], hasSplat: boolean): readonly number[] {
  // Sort key, compared lexicographically descending. Higher tuples win.
  //
  // [hasSplatPenalty, depth, staticCount, dynamicCount]
  //   hasSplatPenalty: 0 if no splat, -1 if splat (splat routes always last)
  //   depth: total segment count (longer paths win — but splat penalty dominates)
  //   staticCount: number of static segments (more static beats more dynamic at same depth)
  //   dynamicCount: negated so fewer dynamics wins the tiebreak at equal depth/static
  //
  // Root ("/" → 0 segments, no splat) ends up with [0, 0, 0, 0]. Any non-root static route
  // outranks it at the same numeric level only when paths overlap — but since /  only matches
  // the bare root URL, there's no actual conflict; the depth-first sort still produces correct
  // results because root only matches empty URL segments.
  let staticCount = 0;
  let dynamicCount = 0;
  for (const seg of segments) {
    if (seg.kind === 'static') staticCount++;
    else if (seg.kind === 'param') dynamicCount++;
  }
  return Object.freeze([
    hasSplat ? -1 : 0,
    segments.length,
    staticCount,
    -dynamicCount,
  ]);
}

export function compareSpecificity(a: readonly number[], b: readonly number[]): number {
  // Descending sort: higher tuple comes first.
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return b[i] - a[i];
  }
  return 0;
}
