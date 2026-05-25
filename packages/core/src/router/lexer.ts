export type Token =
  | { type: 'Slash'; column: number }
  | { type: 'Static'; value: string; column: number }
  | { type: 'Param'; name: string; column: number }
  | { type: 'Splat'; column: number };

export class RoutePatternError extends Error {
  public readonly pattern: string;
  public readonly column: number;

  constructor(message: string, pattern: string, column: number) {
    super(`${message} (pattern: "${pattern}", column ${column})`);
    this.name = 'RoutePatternError';
    this.pattern = pattern;
    this.column = column;
  }
}

const IDENT_START = /[A-Za-z_]/;
const IDENT_CONT = /[A-Za-z0-9_]/;

export function tokenize(pattern: string): Token[] {
  if (typeof pattern !== 'string') {
    throw new RoutePatternError('Route path must be a string', String(pattern), 0);
  }
  if (pattern.length === 0) {
    throw new RoutePatternError('Route path cannot be empty', pattern, 0);
  }
  if (pattern[0] !== '/') {
    throw new RoutePatternError('Route path must start with "/"', pattern, 0);
  }

  const tokens: Token[] = [];
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i];

    if (ch === '/') {
      tokens.push({ type: 'Slash', column: i });
      i++;
      continue;
    }

    if (ch === '$') {
      const prev = tokens[tokens.length - 1];
      if (prev && prev.type === 'Static') {
        throw new RoutePatternError(
          'Param marker "$" cannot follow static text within a segment',
          pattern,
          i,
        );
      }

      const nameStart = i + 1;
      if (nameStart >= pattern.length || pattern[nameStart] === '/') {
        tokens.push({ type: 'Splat', column: i });
        i = nameStart;
        continue;
      }

      if (!IDENT_START.test(pattern[nameStart])) {
        throw new RoutePatternError(
          `Param name must start with a letter or underscore, got "${pattern[nameStart]}"`,
          pattern,
          nameStart,
        );
      }

      let j = nameStart + 1;
      while (j < pattern.length && IDENT_CONT.test(pattern[j])) {
        j++;
      }

      if (j < pattern.length && pattern[j] !== '/') {
        throw new RoutePatternError(
          `Unexpected character "${pattern[j]}" in param name`,
          pattern,
          j,
        );
      }

      const name = pattern.slice(nameStart, j);
      tokens.push({ type: 'Param', name, column: i });
      i = j;
      continue;
    }

    const staticStart = i;
    let j = i;
    while (j < pattern.length && pattern[j] !== '/' && pattern[j] !== '$') {
      j++;
    }
    tokens.push({ type: 'Static', value: pattern.slice(staticStart, j), column: staticStart });
    i = j;
  }

  return tokens;
}
