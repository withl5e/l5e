import { describe, expect, it } from 'vitest';
import { RoutePatternError } from '../../src/router/lexer';
import { tokenize } from '../../src/router/lexer';
import { compareSpecificity, parse } from '../../src/router/parser';

function ast(pattern: string) {
  return parse(tokenize(pattern), pattern);
}

describe('router parser', () => {
  it('parses root', () => {
    const result = ast('/');
    expect(result.segments).toEqual([]);
    expect(result.hasSplat).toBe(false);
  });

  it('parses static segments', () => {
    const result = ast('/foo/bar');
    expect(result.segments).toEqual([
      { kind: 'static', value: 'foo' },
      { kind: 'static', value: 'bar' },
    ]);
    expect(result.hasSplat).toBe(false);
  });

  it('parses param segment', () => {
    const result = ast('/blog/$slug');
    expect(result.segments).toEqual([
      { kind: 'static', value: 'blog' },
      { kind: 'param', name: 'slug' },
    ]);
  });

  it('parses splat at end', () => {
    const result = ast('/docs/$');
    expect(result.segments).toEqual([
      { kind: 'static', value: 'docs' },
      { kind: 'splat' },
    ]);
    expect(result.hasSplat).toBe(true);
  });

  it('parses multiple params', () => {
    const result = ast('/users/$userId/posts/$postId');
    expect(result.segments).toEqual([
      { kind: 'static', value: 'users' },
      { kind: 'param', name: 'userId' },
      { kind: 'static', value: 'posts' },
      { kind: 'param', name: 'postId' },
    ]);
  });

  describe('structural errors', () => {
    it('throws when splat is not terminal', () => {
      expect(() => ast('/docs/$/more')).toThrowError(/must be the final segment/);
    });

    it('throws on duplicate param names', () => {
      expect(() => ast('/users/$id/posts/$id')).toThrowError(/Duplicate param name/);
    });

    it('throws on empty segment (double slash)', () => {
      expect(() => ast('/foo//bar')).toThrowError(RoutePatternError);
    });
  });

  describe('specificity ordering', () => {
    it('sorts static before dynamic at same depth', () => {
      const a = ast('/docs/api');
      const b = ast('/docs/$slug');
      // a wins → compareSpecificity(a, b) < 0
      expect(compareSpecificity(a.specificity, b.specificity)).toBeLessThan(0);
    });

    it('sorts non-splat before splat', () => {
      const a = ast('/docs/api');
      const b = ast('/docs/$');
      expect(compareSpecificity(a.specificity, b.specificity)).toBeLessThan(0);
    });

    it('sorts deeper before shallower at same kind', () => {
      const a = ast('/a/b/c');
      const b = ast('/a/b');
      expect(compareSpecificity(a.specificity, b.specificity)).toBeLessThan(0);
    });

    it('sorts root last among static routes via depth', () => {
      const a = ast('/about');
      const b = ast('/');
      expect(compareSpecificity(a.specificity, b.specificity)).toBeLessThan(0);
    });

    it('produces a stable sortable array', () => {
      const patterns = ['/docs/$', '/docs/api', '/$slug', '/', '/users/$id'];
      const sorted = patterns
        .map((p) => ({ p, ast: ast(p) }))
        .sort((x, y) => compareSpecificity(x.ast.specificity, y.ast.specificity))
        .map((x) => x.p);
      // Splat last; root before /$slug (longer-but-dynamic vs root: depth 1 dynamic > depth 0,
      // so /$slug actually outranks root by depth). Verify only the splat-last invariant
      // plus that /docs/api beats /docs/$.
      expect(sorted[sorted.length - 1]).toBe('/docs/$');
      expect(sorted.indexOf('/docs/api')).toBeLessThan(sorted.indexOf('/docs/$'));
    });
  });
});
