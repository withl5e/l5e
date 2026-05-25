import { describe, expect, it } from 'vitest';
import { RoutePatternError, tokenize } from '../../src/router/lexer';

describe('router lexer', () => {
  it('tokenizes root path', () => {
    expect(tokenize('/')).toEqual([{ type: 'Slash', column: 0 }]);
  });

  it('tokenizes static segments', () => {
    expect(tokenize('/foo/bar')).toEqual([
      { type: 'Slash', column: 0 },
      { type: 'Static', value: 'foo', column: 1 },
      { type: 'Slash', column: 4 },
      { type: 'Static', value: 'bar', column: 5 },
    ]);
  });

  it('tokenizes dynamic param', () => {
    expect(tokenize('/blog/$slug')).toEqual([
      { type: 'Slash', column: 0 },
      { type: 'Static', value: 'blog', column: 1 },
      { type: 'Slash', column: 5 },
      { type: 'Param', name: 'slug', column: 6 },
    ]);
  });

  it('tokenizes splat at end', () => {
    expect(tokenize('/docs/$')).toEqual([
      { type: 'Slash', column: 0 },
      { type: 'Static', value: 'docs', column: 1 },
      { type: 'Slash', column: 5 },
      { type: 'Splat', column: 6 },
    ]);
  });

  it('tokenizes multiple dynamic segments', () => {
    expect(tokenize('/users/$userId/posts/$postId')).toEqual([
      { type: 'Slash', column: 0 },
      { type: 'Static', value: 'users', column: 1 },
      { type: 'Slash', column: 6 },
      { type: 'Param', name: 'userId', column: 7 },
      { type: 'Slash', column: 14 },
      { type: 'Static', value: 'posts', column: 15 },
      { type: 'Slash', column: 20 },
      { type: 'Param', name: 'postId', column: 21 },
    ]);
  });

  it('tokenizes splat followed by trailing slash as splat then slash', () => {
    // /docs/$ — splat is column 6, no trailing slash; if user wrote /docs/$/ we'd get
    // splat then slash and parser would reject (splat must be terminal).
    const tokens = tokenize('/docs/$/');
    expect(tokens).toEqual([
      { type: 'Slash', column: 0 },
      { type: 'Static', value: 'docs', column: 1 },
      { type: 'Slash', column: 5 },
      { type: 'Splat', column: 6 },
      { type: 'Slash', column: 7 },
    ]);
  });

  describe('errors', () => {
    it('throws on empty pattern', () => {
      expect(() => tokenize('')).toThrow(RoutePatternError);
    });

    it('throws when pattern does not start with /', () => {
      expect(() => tokenize('foo')).toThrowError(/must start with "\/"/);
    });

    it('throws on $ in middle of static segment (prefix$name)', () => {
      expect(() => tokenize('/files/prefix$name')).toThrowError(
        /cannot follow static text/,
      );
    });

    it('throws on param name starting with digit', () => {
      expect(() => tokenize('/foo/$1name')).toThrowError(/must start with a letter/);
    });

    it('throws on invalid char in param name', () => {
      expect(() => tokenize('/foo/$name-bad')).toThrowError(/Unexpected character/);
    });

    it('includes column in error message', () => {
      try {
        tokenize('/files/prefix$name');
        expect.fail('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(RoutePatternError);
        expect((err as RoutePatternError).column).toBe(13);
      }
    });
  });
});
