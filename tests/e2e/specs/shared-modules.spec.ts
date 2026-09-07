import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { coreVite } from '../../../packages/core/dist/vite-plugin.js';
import { createServer } from '../../../packages/core/dist/server.js';

const coreRoot = fileURLToPath(new URL('../../../packages/core/', import.meta.url));

type Scenario = {
  name: string;
  globalStore: boolean;
  chunks?: 'together' | 'separate';
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
    'src/client.global.ts',
    scenario.globalStore
      ? `import { store } from './session'; window.globalStore = store;`
      : `window.bootstrapRan = true;`,
  );
  await write(
    'src/island-strategies.ts',
    `
    import { registerMountStrategy } from '@withl5e/l5e/island/client';
    registerMountStrategy('click', mount => document.querySelector('#mount').addEventListener('click', mount, { once: true }));
  `,
  );
  await write(
    'src/common.ts',
    `import { store } from './session'; window.commonStore = store; window.commonRuns = (window.commonRuns || 0) + 1;`,
  );
  await write(
    'src/direct.ts',
    `export { store } from './session'; window.directRuns = (window.directRuns || 0) + 1;`,
  );
  await write(
    'src/page-a.ts',
    `
    import { store } from './direct';
    window.pageAStore = store;
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
  await write('src/page-b.ts', `import { store } from './direct'; window.pageBStore = store;`);
  await write(
    'src/react/Counter.ts',
    `
    import { createElement, useSyncExternalStore } from 'react';
    import { store } from '../session';
    window.islandStore = store;
    export default function Counter() {
      const value = useSyncExternalStore(store.subscribe, store.get);
      return createElement('button', { id: 'island-increment', onClick: () => store.set(value + 1) }, String(value));
    }
  `,
  );
  await write('src/lazy.ts', `import './lazy.css'; export { store } from './session';`);
  await write('src/lazy.css', '#island-increment { color: rgb(1, 2, 3); }');
  await build({
    configFile: false,
    root,
    base: scenario.base || '/',
    logLevel: 'silent',
    plugins: [coreVite()],
    resolve: {
      alias: [
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
          ['common', 'direct', 'page-a', 'page-b', 'react/Counter'].map((name) => [
            name,
            path.join(root, `src/${name}.ts`),
          ]),
        ),
        output: scenario.chunks
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
      return {
        html: '<main><button id="increment">Increment</button><output id="plain">0</output><button id="mount">Mount</button><section id="fragment"></section><div data-island="counter" data-island-name="default" data-island-mount="click"></div></main>',
        scripts: ['/src/common.ts', '/src/direct.ts', url.endsWith('b') ? '/src/page-b.ts' : '/src/page-a.ts'],
        islands: [{ key: 'counter', src: 'src/react/Counter.ts' }],
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
  { name: 'store absent from global bootstrap', globalStore: false },
  { name: 'developer combines vendor and session', globalStore: true, chunks: 'together' },
  { name: 'developer splits vendor and renames session', globalStore: true, chunks: 'separate' },
  { name: 'application under a base path', globalStore: true, chunks: 'separate', base: '/guide/' },
] satisfies Scenario[]) {
  test(`shared module identity: ${scenario.name}`, async ({ page, request }) => {
    const site = await fixture(scenario);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    try {
      await page.goto(site.baseURL);
      await page.waitForFunction(() => !!window.pageAStore);
      expect(await page.evaluate(() => window.commonStore === window.pageAStore)).toBe(true);
      if (scenario.globalStore)
        expect(await page.evaluate(() => window.globalStore === window.pageAStore)).toBe(true);
      expect(await page.evaluate(() => window.islandStore)).toBeUndefined();
      await page.locator('#increment').click();
      await expect(page.locator('#plain')).toHaveText('1');
      await page.locator('#mount').click();
      await expect(page.locator('#island-increment')).toHaveText('1');
      expect(await page.evaluate(async () => (await window.loadLazy()) === window.pageAStore)).toBe(
        true,
      );
      await expect(page.locator('#island-increment')).toHaveCSS('color', 'rgb(1, 2, 3)');
      await page.locator('#island-increment').click();
      await expect(page.locator('#plain')).toHaveText('2');
      const html = await (await request.get(site.baseURL + 'b')).text();
      const bundle = html.match(/src="([^" ]*bundle-[^" ]+\.js)"/)?.[1];
      expect(bundle).toBeTruthy();
      const bundleCode = await (await request.get(site.origin + bundle)).text();
      expect(bundleCode).toContain('commonRuns');
      expect(bundleCode).toContain('pageBStore');
      expect(bundleCode).not.toContain('storeInitializations');
      expect(bundleCode).not.toContain('directRuns');
      await page.evaluate((url) => import(url), site.origin + bundle);
      expect(
        await page.evaluate(() => ({
          same:
            window.pageAStore === window.pageBStore && window.islandStore === window.commonStore,
          value: window.pageBStore.get(),
          initializations: window.storeInitializations,
          commonRuns: window.commonRuns,
          directRuns: window.directRuns,
        })),
      ).toEqual({ same: true, value: 2, initializations: 1, commonRuns: 2, directRuns: 1 });
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
