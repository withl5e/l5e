import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  findGlobalStyleInput,
  resolveGlobalStyleHref,
  withAssetBase,
} from '../src/core/global-style';
import { coreVite } from '../src/core/vite-plugin';

const roots: string[] = [];

async function makeRoot(withGlobalCss: boolean): Promise<string> {
  const root = join(tmpdir(), `l5e-global-style-${process.pid}-${roots.length}`);
  roots.push(root);
  await mkdir(join(root, 'src'), { recursive: true });
  if (withGlobalCss) await writeFile(join(root, 'src/global.css'), 'body {}');
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('global stylesheet convention', () => {
  it('discovers only src/global.css', async () => {
    const withCss = await makeRoot(true);
    const withoutCss = await makeRoot(false);

    expect(findGlobalStyleInput(withCss)).toBe(join(withCss, 'src/global.css'));
    expect(findGlobalStyleInput(withoutCss)).toBeNull();
  });

  it('uses the source URL in development and respects base', async () => {
    const root = await makeRoot(true);

    expect(
      resolveGlobalStyleHref({ root, isProduction: false, base: '/docs/', manifest: undefined }),
    ).toBe('/docs/src/global.css');
  });

  it('registers src/global.css as a standalone Vite build entry', async () => {
    const root = await makeRoot(true);
    const plugin = coreVite();
    const hook = (plugin as any).config;
    const handler = typeof hook === 'function' ? hook : hook.handler;
    const config = handler.call({}, { root, build: {} });

    expect(config.build.rollupOptions.input['global-style']).toBe(join(root, 'src/global.css'));
  });

  it('uses the hashed manifest file in production', async () => {
    const root = await makeRoot(false);

    expect(
      resolveGlobalStyleHref({
        root,
        isProduction: true,
        base: '/',
        manifest: { 'src/global.css': { file: 'assets/global-CSS123.css' } },
      }),
    ).toBe('/assets/global-CSS123.css');
  });

  it('does not emit a stylesheet when the convention is absent', async () => {
    const root = await makeRoot(false);

    expect(
      resolveGlobalStyleHref({ root, isProduction: false, base: '/', manifest: undefined }),
    ).toBeNull();
    expect(
      resolveGlobalStyleHref({ root, isProduction: true, base: '/', manifest: {} }),
    ).toBeNull();
  });

  it('joins root and nested asset bases without duplicate slashes', () => {
    expect(withAssetBase('/', '/src/global.css')).toBe('/src/global.css');
    expect(withAssetBase('/docs', '/src/global.css')).toBe('/docs/src/global.css');
  });
});
