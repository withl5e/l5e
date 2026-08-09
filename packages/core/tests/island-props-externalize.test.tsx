import { describe, expect, it } from 'vitest';
import { getIslandProps, jsxFactory as h, runInRenderContext } from '../src/core/jsx-runtime';
import { renderJsxToHtmlString } from '../src/core/render';
import { ClientIsland } from '../src/island/ClientIsland';

const island = (attrs: Record<string, unknown>) =>
  h(ClientIsland, {
    from: './react/Counter',
    __key: 'Counter_a3f2',
    __src: 'src/views/x/react/Counter.tsx',
    ...attrs,
  });

describe('ClientIsland — externalized props (default)', () => {
  it('emits data-island-idx and stashes props in the store, not inline', async () => {
    const { html, data } = await runInRenderContext(
      () => {
        const html = renderJsxToHtmlString(island({ props: { count: 5, label: 'hi' } }));
        return { html, data: getIslandProps() };
      },
      {},
      undefined,
      { externalizeIslandProps: true },
    );

    expect(html).toContain('data-island-idx="0"');
    expect(html).not.toContain('data-island-props');
    expect(data).toEqual([{ count: 5, label: 'hi' }]);
  });

  it('assigns contiguous indices in render order', async () => {
    const { html, data } = await runInRenderContext(
      () => {
        const a = renderJsxToHtmlString(island({ props: { n: 1 } }));
        const b = renderJsxToHtmlString(island({ props: { n: 2 } }));
        return { html: a + b, data: getIslandProps() };
      },
      {},
      undefined,
      { externalizeIslandProps: true },
    );

    expect(html).toContain('data-island-idx="0"');
    expect(html).toContain('data-island-idx="1"');
    expect(data).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('omits props entirely for mount="none" (never hydrates → props are dead weight)', async () => {
    const { html, data } = await runInRenderContext(
      () => {
        const html = renderJsxToHtmlString(island({ props: { big: 'x' }, mount: 'none' }));
        return { html, data: getIslandProps() };
      },
      {},
      undefined,
      { externalizeIslandProps: true },
    );

    expect(html).not.toContain('data-island-idx');
    expect(html).not.toContain('data-island-props');
    expect(data).toEqual([]);
  });
});

describe('ClientIsland — ssr islands', () => {
  it('externalizes props for an ssr island that will hydrate', async () => {
    const { html, data } = await runInRenderContext(
      () => {
        const html = renderJsxToHtmlString(island({ props: { count: 5 }, ssr: true }));
        return { html, data: getIslandProps() };
      },
      {},
      undefined,
      { externalizeIslandProps: true },
    );

    // Hydration needs props on the client → idx present + stored, and the SSR
    // token is emitted for entry-server to fill.
    expect(html).toContain('data-island-idx="0"');
    expect(html).toContain('data-island-ssr="__L5E_SSR_0__"');
    expect(html).not.toContain('data-island-props');
    expect(data).toEqual([{ count: 5 }]);
  });
});

describe('ClientIsland — legacy inline mode (opt-out)', () => {
  it('inlines data-island-props when externalization is off', async () => {
    const { html, data } = await runInRenderContext(
      () => {
        const html = renderJsxToHtmlString(island({ props: { count: 5 } }));
        return { html, data: getIslandProps() };
      },
      {},
      undefined,
      { externalizeIslandProps: false },
    );

    expect(html).toContain('data-island-props="{&quot;count&quot;:5}"');
    expect(html).not.toContain('data-island-idx');
    expect(data).toEqual([]);
  });

  it('is the default when no option is passed', async () => {
    const html = await runInRenderContext(
      () => renderJsxToHtmlString(island({ props: { count: 5 } })),
      {},
    );
    expect(html).toContain('data-island-props');
    expect(html).not.toContain('data-island-idx');
  });
});
