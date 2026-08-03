import { describe, expect, it } from 'vitest';
import {
  getClientJsEntries,
  getCssEntries,
  runInRenderContext,
  useClientJs,
  useCss,
} from '../src/core/jsx-runtime';

const paths = (entries: Array<{ path: string }>) => entries.map((entry) => entry.path);

describe('useCss registry', () => {
  it('registers the same path only once', async () => {
    const result = await runInRenderContext(() => {
      useCss('/a.css');
      useCss('/a.css');
      useCss('/a.css');
      return getCssEntries();
    }, {});

    expect(paths(result)).toEqual(['/a.css']);
  });

  it('normalizes paths so a missing leading slash is not a separate entry', async () => {
    const result = await runInRenderContext(() => {
      useCss('a.css');
      useCss('/a.css');
      return getCssEntries();
    }, {});

    expect(paths(result)).toEqual(['/a.css']);
  });

  it('normalizes backslashes to web paths', async () => {
    const result = await runInRenderContext(() => {
      useCss('src\\styles\\home.css');
      useCss('/src/styles/home.css');
      return getCssEntries();
    }, {});

    expect(paths(result)).toEqual(['/src/styles/home.css']);
  });

  it('keeps first-call order (cascade order matters)', async () => {
    const result = await runInRenderContext(() => {
      useCss('/b.css');
      useCss('/a.css');
      useCss('/b.css');
      return getCssEntries();
    }, {});

    expect(paths(result)).toEqual(['/b.css', '/a.css']);
  });

  it('ignores empty and whitespace-only paths', async () => {
    const result = await runInRenderContext(() => {
      useCss('');
      useCss('   ');
      return getCssEntries();
    }, {});

    expect(result).toEqual([]);
  });
});

describe('useClientJs registry', () => {
  it('registers the same path only once', async () => {
    const result = await runInRenderContext(() => {
      useClientJs('/counter.ts');
      useClientJs('counter.ts');
      return getClientJsEntries();
    }, {});

    expect(paths(result)).toEqual(['/counter.ts']);
  });

  it('keeps first-call order', async () => {
    const result = await runInRenderContext(() => {
      useClientJs('/b.ts');
      useClientJs('/a.ts');
      useClientJs('/b.ts');
      return getClientJsEntries();
    }, {});

    expect(paths(result)).toEqual(['/b.ts', '/a.ts']);
  });
});

describe('render context isolation', () => {
  it('does not leak registrations between requests', async () => {
    const first = await runInRenderContext(() => {
      useCss('/a.css');
      useClientJs('/a.ts');
      return { css: getCssEntries(), js: getClientJsEntries() };
    }, {});

    const second = await runInRenderContext(() => {
      useCss('/b.css');
      useClientJs('/b.ts');
      return { css: getCssEntries(), js: getClientJsEntries() };
    }, {});

    expect(paths(first.css)).toEqual(['/a.css']);
    expect(paths(second.css)).toEqual(['/b.css']);
    expect(paths(first.js)).toEqual(['/a.ts']);
    expect(paths(second.js)).toEqual(['/b.ts']);
  });
});
