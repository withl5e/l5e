import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, createServer as createViteServer } from 'vite';
import { coreVite } from '../../../packages/core/dist/vite-plugin.js';
import { createServer } from '../../../packages/core/dist/server.js';

const coreRoot = fileURLToPath(new URL('../../../packages/core/', import.meta.url));

test('compact config uses the development island loader contract', async ({ page }) => {
  const parent = path.join(coreRoot, 'tests/.l5e-temp');
  await fs.mkdir(parent, { recursive: true });
  const root = await fs.mkdtemp(path.join(parent, 'compact-dev-'));
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'package.json'), '{"type":"module"}');
  await fs.writeFile(
    path.join(root, 'index.html'),
    `<main><div data-island="counter" data-island-name="default" data-island-mount="media" data-island-opts="(min-width: 2000px)"></div></main>
     <script type="module">
       window.__L5E_ISLANDS__ = {
         counter: '/src/Counter.js',
       };
       await import('/src/client.global.ts');
     </script>`,
  );
  await fs.writeFile(path.join(root, 'src/client.global.ts'), 'window.bootstrapRan = true;');
  await fs.writeFile(
    path.join(root, 'src/Counter.js'),
    `import { createElement } from 'react';
     export default function Counter() { return createElement('output', { id: 'mounted' }, 'mounted'); }`,
  );
  const server = await createViteServer({
    root,
    configFile: false,
    logLevel: 'error',
    resolve: {
      alias: {
        '@withl5e/l5e/island/compact-runtime': path.join(
          coreRoot,
          'dist/island/compact-runtime.js',
        ),
        '@withl5e/l5e/island/runtime': path.join(coreRoot, 'dist/island/runtime.js'),
      },
    },
    plugins: [coreVite({ chunking: { mode: 'compact' } })],
    server: { host: '127.0.0.1', port: 0 },
  });
  const errors: string[] = [];
  const islandRequests: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', (request) => {
    if (request.url().includes('/src/Counter.js')) islandRequests.push(request.url());
  });
  try {
    await server.listen();
    const origin = server.resolvedUrls?.local[0];
    if (!origin) throw new Error('Vite did not expose a local development URL');
    await page.goto(origin);
    expect(await page.locator('#mounted').count()).toBe(0);
    expect(islandRequests).toEqual([]);
    await page.setViewportSize({ width: 2200, height: 720 });
    await expect(page.locator('#mounted')).toHaveText('mounted');
    expect(islandRequests).toHaveLength(1);
    expect(errors).toEqual([]);
  } finally {
    await server.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});

type Scenario = {
  name: string;
  globalStore: boolean;
  chunks?: 'together' | 'separate' | 'configured' | 'compact';
  base?: string;
};

async function fixture(scenario: Scenario) {
  // Keep fixtures outside coreVite's package-root temporary cleanup directory,
  // so a concurrent core build/test cannot delete an active browser fixture.
  const parent = path.join(coreRoot, 'tests/.l5e-temp');
  await fs.mkdir(parent, { recursive: true });
  const root = await fs.mkdtemp(path.join(parent, 'shared-modules-'));
  async function write(file: string, content: string) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), content);
  }
  await write('package.json', '{"type":"module"}');
  await write(
    'index.html',
    '<!doctype html><html><head><!--app-head--></head><body><!--app-html--><!--app-scripts--></body></html>',
  );
  await write(
    'src/session.ts',
    `
    window.storeInitializations = (window.storeInitializations || 0) + 1;
    let value = 0;
    const listeners = new Set();
    export const store = {
      get: () => value,
      set: next => { value = next; for (const listener of listeners) listener(); },
      subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    };
  `,
  );
  await write(
    'src/global-owned.ts',
    `window.globalOwnedInitializations = (window.globalOwnedInitializations || 0) + 1; export const globalOwned = { value: 1 };`,
  );
  await write(
    'src/session-two.ts',
    `window.secondStoreInitializations = (window.secondStoreInitializations || 0) + 1; export const store = { marker: 'second' };`,
  );
  await write(
    'src/client.global.ts',
    scenario.globalStore
      ? `import { store } from './session'; import { store as secondStore } from './session-two'; import { globalOwned } from './global-owned'; window.globalStore = store; window.secondStoreFromGlobal = secondStore; window.globalOwnedFromGlobal = globalOwned;`
      : `import { globalOwned } from './global-owned'; window.bootstrapRan = true; window.globalOwnedFromGlobal = globalOwned;`,
  );
  await write(
    'src/island-strategies.ts',
    `
    import { registerMountStrategy } from '@withl5e/l5e/island/client';
    registerMountStrategy('click', mount => document.querySelector('#mount').addEventListener('click', mount, { once: true }));
    registerMountStrategy('click-b', mount => document.querySelector('#mount-b').addEventListener('click', mount, { once: true }));
  `,
  );
  await write(
    'src/common.ts',
    `import { store } from './session'; window.commonStore = store; window.commonRuns = (window.commonRuns || 0) + 1;`,
  );
  await write(
    'src/direct.ts',
    `export { store } from './session'; window.directRuns = (window.directRuns || 0) + 1; window.commonRunsAtDirect = window.commonRuns;`,
  );
  await write(
    'src/page-a.ts',
    `
    import { store } from './direct';
    import { globalOwned } from './global-owned';
    import { store as secondStore } from './session-two';
    window.pageAStore = store;
    window.globalOwnedFromPageA = globalOwned;
    window.secondStoreFromPageA = secondStore;
    store.subscribe(() => document.querySelector('#plain').textContent = String(store.get()));
    document.querySelector('#increment').onclick = () => store.set(store.get() + 1);
    window.loadLazy = () => import('./lazy').then(mod => mod.store);
    window.swapFragment = async () => {
      const { createSwap } = await import('@withl5e/l5e/swap');
      const swap = createSwap({ target: '#fragment' });
      await swap.exec('<p>Swapped</p>');
      swap.destroy();
    };
  `,
  );
  await write('src/page-b.ts', `import { store } from './direct'; import { globalOwned } from './global-owned'; window.pageBStore = store; window.globalOwnedFromPageB = globalOwned;`);
  await write(
    'src/react/Counter.ts',
    `
    import './Counter.css';
    import { createElement, useSyncExternalStore } from 'react';
    import { store } from '../session';
    window.islandStore = store;
    export default function Counter() {
      const value = useSyncExternalStore(store.subscribe, store.get);
      return createElement('button', { id: 'island-increment', onClick: () => store.set(value + 1) }, String(value));
    }
  `,
  );
  await write('src/react/Counter.css', '#island-increment { background-color: rgb(4, 5, 6); }');
  await write(
    'src/react/CounterB.ts',
    `
    import { createElement, useState } from 'react';
    window.counterBInitializations = (window.counterBInitializations || 0) + 1;
    export default function CounterB() {
      const [value, setValue] = useState(7);
      return createElement('button', { id: 'counter-b', onClick: () => setValue(value + 1) }, String(value));
    }
  `,
  );
  await write(
    'src/lazy.ts',
    `import './lazy.css'; import './lazy-sdk'; export { store } from './session';`,
  );
  await write(
    'src/lazy-sdk.ts',
    `window.lazySdkRuns = (window.lazySdkRuns || 0) + 1; export const sdk = {};`,
  );
  await write('src/lazy.css', '#island-increment { color: rgb(1, 2, 3); }');
  await build({
    configFile: false,
    root,
    base: scenario.base || '/',
    logLevel: 'silent',
    plugins: [
      coreVite({
        chunking:
          scenario.chunks === 'compact'
            ? {
                mode: 'compact',
                shared: [
                  { name: 'state', modules: ['~/session.ts', '~/session-two.ts'] },
                ],
              }
            : scenario.chunks === 'configured'
            ? {
                shared: [
                  { name: 'state', modules: ['~/session.ts', '~/lazy-sdk.ts'] },
                  { name: 'react', packages: ['react', 'react-dom', 'scheduler'] },
                ],
              }
            : scenario.chunks
              ? false
              : {},
      }),
    ],
    resolve: {
      alias: [
        { find: '~', replacement: `${root.replace(/\\/g, '/')}/src` },
        {
          find: /^@withl5e\/l5e\/(.+)$/,
          replacement: `${coreRoot.replace(/\\/g, '/')}/dist/$1.js`,
        },
      ],
    },
    build: {
      outDir: 'dist/client',
      manifest: true,
      rolldownOptions: {
        input: Object.fromEntries(
          ['common', 'direct', 'page-a', 'page-b', 'react/Counter', 'react/CounterB'].map((name) => [
            name,
            path.join(root, `src/${name}.ts`),
          ]),
        ),
        output:
          scenario.chunks &&
          scenario.chunks !== 'configured' &&
          scenario.chunks !== 'compact'
            ? {
                manualChunks: (id) => {
                  const normalized = id.replace(/\\/g, '/');
                  const react = normalized.includes('/node_modules/react');
                  const store = normalized.endsWith('/session.ts');
                  if (scenario.chunks === 'together' && (react || store)) return 'developer-choice';
                  if (store) return 'my-session';
                  if (react) return normalized.includes('react-dom') ? 'renderer' : 'ui-library';
                },
              }
            : undefined,
      },
    },
  });
  await write(
    'dist/server/entry-server.js',
    `
    export async function render(url) {
      const parsed = new URL(url, 'http://fixture');
      const strategy = parsed.searchParams.get('strategy');
      if (strategy) {
        const ssr = parsed.searchParams.has('ssr');
        const opts = strategy === 'media' ? ' data-island-opts="(max-width: 500px)"' : '';
        const spacer = strategy === 'visible' ? '<div style="height:3000px"></div>' : '';
        const content = ssr ? '<button id="counter-b">7</button>' : '';
        return {
          html: '<main>' + spacer + '<div data-island="counter-b" data-island-name="default" data-island-mount="' + strategy + '"' + opts + (ssr ? ' data-island-ssr="1"' : '') + '>' + content + '</div></main>',
          scripts: ['/src/common.ts', '/src/direct.ts', '/src/page-a.ts'],
          islands: [{ key: 'counter-b', src: 'src/react/CounterB.ts' }],
        };
      }
      return {
        html: '<main><button id="increment">Increment</button><output id="plain">0</output><button id="mount">Mount</button><button id="mount-b">Mount B</button><section id="fragment"></section><div data-island="counter" data-island-name="default" data-island-mount="click"></div><div data-island="counter-b" data-island-name="default" data-island-mount="click-b"></div></main>',
        scripts: ['/src/common.ts', '/src/direct.ts', url.endsWith('b') ? '/src/page-b.ts' : '/src/page-a.ts'],
        islands: [{ key: 'counter', src: 'src/react/Counter.ts' }, { key: 'counter-b', src: 'src/react/CounterB.ts' }],
      };
    }
  `,
  );
  const previousMode = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const { app } = await createServer({ root, base: scenario.base });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    root,
    origin,
    baseURL: origin + (scenario.base || '/'),
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      });
      if (previousMode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousMode;
      await fs.rm(root, { recursive: true, force: true });
    },
  };
}

for (const scenario of [
  { name: 'automatic chunks', globalStore: true },
  { name: 'configured state and React groups', globalStore: true, chunks: 'configured' },
  { name: 'compact three-file contract', globalStore: true, chunks: 'compact' },
  { name: 'compact contract under a base path', globalStore: true, chunks: 'compact', base: '/guide/' },
  { name: 'store absent from global bootstrap', globalStore: false },
  { name: 'developer combines vendor and session', globalStore: true, chunks: 'together' },
  { name: 'developer splits vendor and renames session', globalStore: true, chunks: 'separate' },
  { name: 'application under a base path', globalStore: true, chunks: 'separate', base: '/guide/' },
] satisfies Scenario[]) {
  test(`shared module identity: ${scenario.name}`, async ({ page, request }) => {
    const site = await fixture(scenario);
    const errors: string[] = [];
    let compactInitialJs = new Set<string>();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    try {
      await page.goto(site.baseURL);
      await page.waitForFunction(() => !!window.pageAStore);
      if (!scenario.chunks || scenario.chunks === 'configured' || scenario.chunks === 'compact') {
        const report = JSON.parse(
          await fs.readFile(path.join(site.root, 'dist/client/.vite/l5e-chunks.json'), 'utf8'),
        );
        expect(report.version).toBe(2);
        expect(report.warnings).toEqual([]);
        expect(
          report.chunks.every((chunk) =>
            /^assets\/(global-|bundle-|island-|shared-|lazy-)/.test(chunk.file),
          ),
        ).toBe(true);
        const stateChunks = report.chunks.filter((chunk) =>
          chunk.modules.some((mod) => mod.id === 'src/session.ts'),
        );
        expect(stateChunks).toHaveLength(1);
        if (scenario.chunks === 'configured') {
          const lazyChunk = report.chunks.find((chunk) =>
            chunk.modules.some((mod) => mod.id === 'src/lazy-sdk.ts'),
          );
          expect(stateChunks[0].file).toContain('shared-state-global');
          expect(lazyChunk.file).toContain('shared-state-lazy');
          const loaded = await page.evaluate(() =>
            performance.getEntriesByType('resource').map((entry) => entry.name),
          );
          expect(loaded.some((url) => url.includes(lazyChunk.file))).toBe(false);
          const html = await page.content();
          expect(html).not.toContain(`href="/${lazyChunk.file}"`);
        }
        if (scenario.chunks === 'compact') {
          expect(report.mode).toBe('compact');
          const jsUrls = await page.evaluate(() => {
            const origin = location.origin;
            return performance
              .getEntriesByType('resource')
              .map((entry) => entry.name)
              .filter((url) => url.startsWith(origin) && /\.js(?:\?|$)/.test(url));
          });
          expect(new Set(jsUrls).size, jsUrls.join('\n')).toBeLessThanOrEqual(3);
          compactInitialJs = new Set(jsUrls);
          expect(jsUrls.some((url) => url.includes('lazy-react-runtime'))).toBe(false);
          expect(jsUrls.some((url) => url.includes('Counter'))).toBe(false);
        }
      }
      expect(await page.evaluate(() => window.commonRunsAtDirect)).toBe(1);
      expect(await page.evaluate(() => window.commonStore === window.pageAStore)).toBe(true);
      expect(
        await page.evaluate(() => window.globalOwnedFromGlobal === window.globalOwnedFromPageA),
      ).toBe(true);
      expect(await page.evaluate(() => window.globalOwnedInitializations)).toBe(1);
      if (scenario.chunks === 'compact') {
        expect(
          await page.evaluate(() => window.secondStoreFromGlobal === window.secondStoreFromPageA),
        ).toBe(true);
        expect(await page.evaluate(() => window.secondStoreInitializations)).toBe(1);
      }
      if (scenario.globalStore)
        expect(await page.evaluate(() => window.globalStore === window.pageAStore)).toBe(true);
      expect(await page.evaluate(() => window.islandStore)).toBeUndefined();
      expect(await page.evaluate(() => window.counterBInitializations)).toBeUndefined();
      if (scenario.chunks === 'compact') {
        expect(
          await page.evaluate(() =>
            performance
              .getEntriesByType('resource')
              .some((entry) => entry.name.includes('Counter') && entry.name.includes('.css')),
          ),
        ).toBe(false);
      }
      expect(await page.evaluate(() => window.lazySdkRuns)).toBeUndefined();
      await page.locator('#increment').click();
      await expect(page.locator('#plain')).toHaveText('1');
      if (scenario.chunks === 'compact') {
        const plan = await page.evaluate(() => window.__L5E_ISLANDS__.counter);
        const requested = new Set<string>();
        page.on('request', (request) => requested.add(request.url()));
        let release!: () => void;
        const held = new Promise<void>((resolve) => (release = resolve));
        let rootRequested = false;
        await page.route(new URL(plan.module, site.origin).href, async (route) => {
          rootRequested = true;
          await held;
          await route.continue();
        });
        await page.locator('#mount').click();
        await expect.poll(() => rootRequested).toBe(true);
        expect(
          plan.js.every((url: string) => requested.has(new URL(url, site.origin).href)),
          `Requests before island root response: ${[...requested].join('\n')}`,
        ).toBe(true);
        release();
      } else {
        await page.locator('#mount').click();
      }
      await expect(page.locator('#island-increment')).toHaveText('1');
      if (scenario.chunks === 'compact') {
        await expect(page.locator('#island-increment')).toHaveCSS(
          'background-color',
          'rgb(4, 5, 6)',
        );
      }
      expect(await page.evaluate(() => window.counterBInitializations)).toBeUndefined();
      if (scenario.chunks === 'compact') {
        const jsUrls = await page.evaluate(() =>
          performance
            .getEntriesByType('resource')
            .map((entry) => entry.name)
            .filter((url) => url.startsWith(location.origin) && /\.js(?:\?|$)/.test(url)),
        );
        expect(new Set(jsUrls).size).toBeGreaterThan(3);
        expect(jsUrls.filter((url) => !compactInitialJs.has(url))).toHaveLength(2);
        expect(jsUrls.some((url) => /\/renderer-[^/]+\.js$/.test(url))).toBe(true);
      }
      await page.locator('#mount-b').click();
      await expect(page.locator('#counter-b')).toHaveText('7');
      expect(await page.evaluate(() => window.counterBInitializations)).toBe(1);
      if (scenario.chunks === 'compact') {
        const jsUrls = await page.evaluate(() =>
          performance
            .getEntriesByType('resource')
            .map((entry) => entry.name)
            .filter((url) => url.startsWith(location.origin) && /\.js(?:\?|$)/.test(url)),
        );
        expect(jsUrls.filter((url) => !compactInitialJs.has(url))).toHaveLength(3);
      }
      expect(await page.evaluate(() => window.lazySdkRuns)).toBeUndefined();
      expect(await page.evaluate(async () => (await window.loadLazy()) === window.pageAStore)).toBe(
        true,
      );
      await expect(page.locator('#island-increment')).toHaveCSS('color', 'rgb(1, 2, 3)');
      expect(await page.evaluate(() => window.lazySdkRuns)).toBe(1);
      if (scenario.chunks === 'compact') {
        const jsUrls = await page.evaluate(() =>
          performance
            .getEntriesByType('resource')
            .map((entry) => entry.name)
            .filter((url) => url.startsWith(location.origin) && /\.js(?:\?|$)/.test(url)),
        );
        expect(new Set(jsUrls).size).toBeGreaterThan(3);
        expect(jsUrls.filter((url) => !compactInitialJs.has(url))).toHaveLength(5);
      }
      await page.locator('#island-increment').click();
      await expect(page.locator('#plain')).toHaveText('2');
      const html = await (await request.get(site.baseURL + 'b')).text();
      const bundle = html.match(/src="([^" ]*bundle-[^" ]+\.js)"/)?.[1];
      expect(bundle).toBeTruthy();
      const bundleCode = await (await request.get(site.origin + bundle)).text();
      if (scenario.chunks === 'compact') expect(bundleCode).toContain('commonRuns');
      else expect(bundleCode).not.toContain('commonRuns');
      expect(bundleCode).toContain('pageBStore');
      expect(bundleCode).not.toContain('storeInitializations');
      if (scenario.chunks === 'compact') expect(bundleCode).toContain('directRuns');
      else expect(bundleCode).not.toContain('directRuns');
      await page.evaluate((url) => import(url), site.origin + bundle);
      expect(
        await page.evaluate(() => ({
          same:
            window.pageAStore === window.pageBStore && window.islandStore === window.commonStore,
          globalOwnedSame: window.globalOwnedFromGlobal === window.globalOwnedFromPageB,
          value: window.pageBStore.get(),
          initializations: window.storeInitializations,
          commonRuns: window.commonRuns,
          directRuns: window.directRuns,
        })),
      ).toEqual({
        same: true,
        globalOwnedSame: true,
        value: 2,
        initializations: 1,
        commonRuns: 2,
        directRuns: scenario.chunks === 'compact' ? 2 : 1,
      });
      await page.evaluate(() => window.swapFragment());
      await expect(page.locator('#fragment')).toHaveText('Swapped');
      await page.locator('#island-increment').click();
      await expect(page.locator('#plain')).toHaveText('3');
      expect(await page.evaluate(() => window.storeInitializations)).toBe(1);
      await page.reload();
      await page.waitForFunction(() => !!window.pageAStore);
      expect(
        await page.evaluate(() => ({
          value: window.pageAStore.get(),
          initializations: window.storeInitializations,
        })),
      ).toEqual({ value: 0, initializations: 1 });
      expect(errors).toEqual([]);
    } finally {
      if (errors.length) console.error(errors);
      await site.close();
    }
  });
}

test('compact strategies gate download, initialization, and hydration', async ({ page }) => {
  const site = await fixture({ name: 'strategy stages', globalStore: true, chunks: 'compact' });
  const initialJs = async () =>
    page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((url) => url.startsWith(location.origin) && /\.js(?:\?|$)/.test(url)),
    );
  try {
    await page.goto(`${site.baseURL}?strategy=none`);
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.counterBInitializations)).toBeUndefined();
    expect(new Set(await initialJs()).size).toBeLessThanOrEqual(3);

    await page.goto(`${site.baseURL}?strategy=visible`);
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.counterBInitializations)).toBeUndefined();
    expect(new Set(await initialJs()).size).toBeLessThanOrEqual(3);
    await page.locator('[data-island="counter-b"]').scrollIntoViewIfNeeded();
    await expect(page.locator('#counter-b')).toHaveText('7');

    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto(`${site.baseURL}?strategy=media`);
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.counterBInitializations)).toBeUndefined();
    await page.setViewportSize({ width: 400, height: 600 });
    await expect(page.locator('#counter-b')).toHaveText('7');

    await page.goto(`${site.baseURL}?strategy=idle`);
    await expect(page.locator('#counter-b')).toHaveText('7');

    await page.goto(`${site.baseURL}?strategy=load`);
    await expect(page.locator('#counter-b')).toHaveText('7');

    await page.goto(`${site.baseURL}?strategy=visible&ssr=1`);
    await expect(page.locator('#counter-b')).toHaveText('7');
    expect(await page.evaluate(() => window.counterBInitializations)).toBeUndefined();
    await page.locator('[data-island="counter-b"]').scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => window.counterBInitializations)).toBe(1);
    await page.locator('#counter-b').click();
    await expect(page.locator('#counter-b')).toHaveText('8');
  } finally {
    await site.close();
  }
});
