import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bundleCss,
  bundleScripts as runBundleScripts,
  clearBundledFiles,
  getBundledFile,
} from '../src/core/bundler';
import { createScriptBundlePolicy } from '../src/core/script-bundle-policy';
import type { Manifest } from 'vite';

/**
 * Runtime bundling chạy trên đường request nên nhiều request đồng thời có thể
 * cùng trigger một bundle. Bộ test này khoá lại hai tính chất: bundle chạy đúng
 * một lần cho mỗi tập input, và không có file tạm nào trên đĩa để hai lần chạy
 * song song giẫm lên nhau.
 */
describe('bundler', () => {
  let tmpRoot: string;
  let distClientDir: string;
  let manifest: Manifest;

  const bundleScripts = (scripts: string[], directory: string) =>
    runBundleScripts(scripts, directory, createScriptBundlePolicy(manifest, directory));

  const writeAsset = async (relativePath: string, content: string) => {
    const absolute = path.join(distClientDir, relativePath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content, 'utf-8');
    manifest[relativePath] = { file: relativePath, isEntry: true };
    return `/${relativePath.replace(/\\/g, '/')}`;
  };

  const executeBundle = async (entryFilename: string) => {
    const executionDir = path.join(tmpRoot, 'execution');
    await fs.mkdir(executionDir, { recursive: true });

    const pending = [entryFilename];
    const written = new Set<string>();
    while (pending.length > 0) {
      const filename = pending.pop()!;
      if (written.has(filename)) {
        continue;
      }
      const bundled = getBundledFile(filename);
      if (!bundled) {
        throw new Error(`Missing generated chunk: ${filename}`);
      }
      written.add(filename);
      // Node executes the bundle while its canonical browser imports resolve to
      // the original emitted assets, exactly as a static server would serve them.
      const executable = bundled.content.replace(
        /(["'])\/assets\/([^"']+)\1/g,
        (_match, _quote, file) =>
          JSON.stringify(pathToFileURL(path.join(distClientDir, 'assets', file)).href),
      );
      await fs.writeFile(path.join(executionDir, filename), executable, 'utf-8');

      for (const match of bundled.content.matchAll(
        /(?:from\s*|import\s*(?:\(\s*)?)["']\.\/(bundle-[^"']+\.js)/g,
      )) {
        pending.push(match[1]);
      }
    }

    await import(`${pathToFileURL(path.join(executionDir, entryFilename)).href}?run=${Date.now()}`);
    return written;
  };

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'l5e-bundler-'));
    distClientDir = path.join(tmpRoot, 'dist', 'client');
    await fs.mkdir(distClientDir, { recursive: true });
    clearBundledFiles();
    manifest = {};
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  describe('bundleScripts', () => {
    it('keeps private roots in runtime output across different page combinations', async () => {
      const alpha = await writeAsset(
        'assets/alpha.js',
        `globalThis.__privateRuns = (globalThis.__privateRuns || 0) + 1;`,
      );
      await writeAsset('assets/state.js', `export const state = {};`);
      const beta = await writeAsset(
        'assets/beta.js',
        `import { state } from './state.js'; globalThis.__betaState = state;`,
      );
      const gamma = await writeAsset('assets/gamma.js', `globalThis.__gammaRan = true;`);
      const delta = await writeAsset(
        'assets/delta.js',
        `import { state } from './state.js'; globalThis.__deltaState = state;`,
      );
      manifest['assets/beta.js'].imports = ['assets/state.js'];
      manifest['assets/delta.js'].imports = ['assets/state.js'];
      for (const other of [beta, gamma, delta]) {
        const result = await bundleScripts([alpha, other], distClientDir);
        expect(result.content).not.toMatch(/["']\/assets\/alpha\.js["']/);
        await executeBundle(result.filename);
      }
      expect(globalThis.__privateRuns).toBe(3);
      expect(globalThis.__betaState).toBe(globalThis.__deltaState);
      delete globalThis.__privateRuns;
      delete globalThis.__betaState;
      delete globalThis.__deltaState;
      delete globalThis.__gammaRan;
    });

    it('runs an earlier entry before a later entry dependency reads its side effects', async () => {
      const alpha = await writeAsset('assets/alpha.js', `globalThis.__entryFlag = 1;`);
      await writeAsset('assets/state.js', `export const captured = globalThis.__entryFlag;`);
      const beta = await writeAsset(
        'assets/beta.js',
        `import { captured } from './state.js'; globalThis.__capturedFlag = captured;`,
      );
      manifest['assets/beta.js'].imports = ['assets/state.js'];
      const result = await bundleScripts([alpha, beta], distClientDir);
      await executeBundle(result.filename);
      expect(globalThis.__capturedFlag).toBe(1);
      expect(result.content).toContain('__capturedFlag');
      delete globalThis.__entryFlag;
      delete globalThis.__capturedFlag;
    });

    it('runs an earlier entry before a later preserved entry', async () => {
      const alpha = await writeAsset('assets/alpha.js', `globalThis.__entryFlag = 2;`);
      const beta = await writeAsset(
        'assets/beta.js',
        `globalThis.__capturedFlag = globalThis.__entryFlag;`,
      );
      manifest['assets/beta.js'].isDynamicEntry = true;
      const result = await bundleScripts([alpha, beta], distClientDir);
      await executeBundle(result.filename);
      expect(globalThis.__capturedFlag).toBe(2);
      delete globalThis.__entryFlag;
      delete globalThis.__capturedFlag;
    });

    it('preserves canonical imports when the client output is a symlink', async () => {
      await writeAsset('assets/session.js', `export const store = {};`);
      const entry = await writeAsset(
        'assets/page.js',
        `import { store } from './session.js'; globalThis.__store = store;`,
      );
      manifest['assets/page.js'].imports = ['assets/session.js'];
      const link = path.join(tmpRoot, 'linked-client');
      await fs.symlink(distClientDir, link, 'junction');
      const result = await runBundleScripts(
        [entry],
        link,
        createScriptBundlePolicy(manifest, link),
      );
      expect(result.filename).toBeTruthy();
      expect(result.content).toContain('/assets/session.js');
      expect(result.content).not.toContain('store = {}');
    });
    it('falls back to original entries when build metadata is unavailable', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const entry = await writeAsset('assets/entry.js', `globalThis.__shouldNotBundle = true;`);
      expect((await runBundleScripts([entry], distClientDir)).filename).toBe('');
    });

    it('preserves an entry imported by another entry in the same runtime bundle', async () => {
      const shared = await writeAsset(
        'assets/shared-entry.js',
        `
        globalThis.__entryRuns = (globalThis.__entryRuns || 0) + 1;
        export const state = { value: 42 };
      `,
      );
      const page = await writeAsset(
        'assets/page.js',
        `
        import { state } from './shared-entry.js'; globalThis.__entryState = state;
      `,
      );
      manifest['assets/page.js'].imports = ['assets/shared-entry.js'];
      const result = await bundleScripts([page, shared], distClientDir);
      await executeBundle(result.filename);
      const original = await import(
        pathToFileURL(path.join(distClientDir, 'assets/shared-entry.js')).href
      );
      expect(globalThis.__entryState).toBe(original.state);
      expect(globalThis.__entryRuns).toBe(1);
      delete globalThis.__entryState;
      delete globalThis.__entryRuns;
    });

    it('preserves a stateful transitive dependency shared with a cyclic chunk graph', async () => {
      await writeAsset('assets/owner.js', `export const state = {};`);
      await writeAsset(
        'assets/left.js',
        `export { state } from './owner.js'; export { label } from './right.js';`,
      );
      await writeAsset(
        'assets/right.js',
        `export { state } from './left.js'; export const label = 'cycle';`,
      );
      const entry = await writeAsset(
        'assets/page.js',
        `
        import { state, label } from './left.js'; import { state as direct } from './owner.js';
        globalThis.__transitive = { same: state === direct, label };
      `,
      );
      manifest['assets/page.js'].imports = ['assets/left.js', 'assets/owner.js'];
      manifest['assets/left.js'].imports = ['assets/right.js', 'assets/owner.js'];
      manifest['assets/right.js'].imports = ['assets/left.js'];
      const result = await bundleScripts([entry], distClientDir);
      await executeBundle(result.filename);
      expect(globalThis.__transitive).toEqual({ same: true, label: 'cycle' });
      delete globalThis.__transitive;
    });

    it('does not reuse a bundle from another output directory or build policy', async () => {
      const entry = await writeAsset('assets/page.js', `globalThis.__buildMarker = 'first';`);
      const first = await bundleScripts([entry], distClientDir);
      const otherDir = path.join(tmpRoot, 'other');
      await fs.mkdir(path.join(otherDir, 'assets'), { recursive: true });
      await fs.writeFile(
        path.join(otherDir, 'assets/page.js'),
        `globalThis.__buildMarker = 'second';`,
      );
      const second = await runBundleScripts(
        [entry],
        otherDir,
        createScriptBundlePolicy(manifest, otherDir),
      );
      expect(first.content).toContain('first');
      expect(second.content).toContain('second');
      const nextManifest = {
        ...manifest,
        'assets/extra.js': { file: 'assets/extra.js', isEntry: true },
      };
      await fs.writeFile(
        path.join(distClientDir, 'assets/page.js'),
        `globalThis.__buildMarker = 'next-build';`,
      );
      const next = await runBundleScripts(
        [entry],
        distClientDir,
        createScriptBundlePolicy(nextManifest, distClientDir),
      );
      expect(next.content).toContain('next-build');
    });

    it('falls back instead of inlining an import missing from the manifest', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      await writeAsset('assets/missing.js', `export const value = 42;`);
      const entry = await writeAsset(
        'assets/page.js',
        `import { value } from './missing.js'; globalThis.__value = value;`,
      );
      delete manifest['assets/missing.js'];
      expect((await bundleScripts([entry], distClientDir)).filename).toBe('');
    });

    it('serves every concurrent caller the same bundle', async () => {
      const alpha = await writeAsset('assets/alpha.js', `globalThis.__alpha = 'alpha-marker';`);
      const beta = await writeAsset('assets/beta.js', `globalThis.__beta = 'beta-marker';`);

      const results = await Promise.all(
        Array.from({ length: 20 }, () => bundleScripts([alpha, beta], distClientDir)),
      );

      const [first] = results;
      expect(first.filename).toMatch(/^bundle-.*\.js$/);
      expect(first.content).toContain('alpha-marker');
      expect(first.content).toContain('beta-marker');

      for (const result of results) {
        expect(result.filename).toBe(first.filename);
        expect(result.content).toBe(first.content);
      }

      expect(getBundledFile(first.filename)?.content).toBe(first.content);
    }, 30_000);

    it('writes no temp files to disk', async () => {
      const alpha = await writeAsset('assets/alpha.js', `globalThis.__alpha = 'alpha-marker';`);

      await Promise.all(Array.from({ length: 5 }, () => bundleScripts([alpha], distClientDir)));

      // Cả rootDir cũ lẫn cwd đều không được sinh ra thư mục entry tạm nào.
      await expect(fs.stat(path.join(tmpRoot, '.temp-bundle'))).rejects.toThrow();
      await expect(fs.stat(path.join(process.cwd(), '.temp-bundle'))).rejects.toThrow();
      await expect(fs.readdir(distClientDir)).resolves.toEqual(['assets']);
    }, 30_000);

    it('keys bundles by execution order and deduplicates repeated roots', async () => {
      const alpha = await writeAsset('assets/alpha.js', `globalThis.__alpha = 'alpha-marker';`);
      const beta = await writeAsset('assets/beta.js', `globalThis.__beta = 'beta-marker';`);

      const [forward, reversed, duplicated] = await Promise.all([
        bundleScripts([alpha, beta], distClientDir),
        bundleScripts([beta, alpha], distClientDir),
        bundleScripts([alpha, beta, alpha], distClientDir),
      ]);

      expect(reversed.filename).not.toBe(forward.filename);
      expect(duplicated.filename).toBe(forward.filename);
    }, 30_000);

    it('reuses the finished bundle instead of running Rolldown again', async () => {
      const alpha = await writeAsset('assets/alpha.js', `globalThis.__alpha = 'alpha-marker';`);

      const first = await bundleScripts([alpha], distClientDir);
      expect(first.filename).toBeTruthy();

      // Xoá source: nếu lần gọi sau chạy lại Rolldown nó sẽ fail, nên kết quả
      // giống hệt chứng minh cache đã phục vụ request thứ hai.
      await fs.rm(path.join(distClientDir, 'assets', 'alpha.js'));

      const second = await bundleScripts([alpha], distClientDir);
      expect(second.filename).toBe(first.filename);
      expect(second.content).toBe(first.content);
    }, 30_000);

    it('does not cache a failed bundle', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const broken = await writeAsset('assets/broken.js', 'export const = ;');

      const failed = await bundleScripts([broken], distClientDir);
      expect(failed.filename).toBe('');

      await writeAsset('assets/broken.js', `globalThis.__fixed = 'fixed-marker';`);

      const retried = await bundleScripts([broken], distClientDir);
      expect(retried.filename).toMatch(/^bundle-.*\.js$/);
      expect(retried.content).toContain('fixed-marker');
    }, 30_000);

    it('returns an empty result for an empty input', async () => {
      await expect(bundleScripts([], distClientDir)).resolves.toEqual({
        hash: '',
        filename: '',
        content: '',
      });
    });

    it('keeps vendor, chunk, and global imports as absolute web paths', async () => {
      const vendor = await writeAsset(
        'assets/vendor-react.js',
        `globalThis.__bundledVendor = 'vendor-body';`,
      );
      const chunk = await writeAsset(
        'assets/chunk-shared.js',
        `globalThis.__bundledChunk = 'chunk-body';`,
      );
      const global = await writeAsset(
        'assets/store.global.js',
        `globalThis.__bundledGlobal = 'global-body';`,
      );
      const absoluteChunk = path.join(distClientDir, chunk.substring(1));
      const entry = await writeAsset(
        'assets/entry.js',
        [
          `import './vendor-react.js';`,
          `import ${JSON.stringify(absoluteChunk)};`,
          `import './store.global.js';`,
        ].join('\n'),
      );

      const result = await bundleScripts([entry], distClientDir);

      expect(result.content).toContain(`import "/assets/vendor-react.js";`);
      expect(result.content).toContain(`import "/assets/chunk-shared.js";`);
      expect(result.content).toContain(`import "/assets/store.global.js";`);
      expect(result.content).not.toContain('vendor-body');
      expect(result.content).not.toContain('chunk-body');
      expect(result.content).not.toContain('global-body');
      expect(vendor).toBe('/assets/vendor-react.js');
      expect(global).toBe('/assets/store.global.js');
    }, 30_000);

    it('preserves caller input side effects and executes a shared module once', async () => {
      const shared = await writeAsset(
        'assets/shared.js',
        `globalThis.__bundleSharedRuns = (globalThis.__bundleSharedRuns || 0) + 1;`,
      );
      const zeta = await writeAsset(
        'assets/zeta.js',
        `import './shared.js'; globalThis.__bundleOrder.push('zeta');`,
      );
      const alpha = await writeAsset(
        'assets/alpha.js',
        `import './shared.js'; globalThis.__bundleOrder.push('alpha');`,
      );
      globalThis.__bundleOrder = [];
      globalThis.__bundleSharedRuns = 0;

      const result = await bundleScripts([zeta, alpha], distClientDir);
      await executeBundle(result.filename);

      expect(globalThis.__bundleOrder).toEqual(['zeta', 'alpha']);
      expect(globalThis.__bundleSharedRuns).toBe(1);
      expect(shared).toBe('/assets/shared.js');
      delete globalThis.__bundleOrder;
      delete globalThis.__bundleSharedRuns;
    }, 30_000);

    it('keeps runtime script side effects when the consumer package disables them', async () => {
      await fs.writeFile(
        path.join(tmpRoot, 'package.json'),
        JSON.stringify({ type: 'module', sideEffects: false }),
        'utf-8',
      );
      const entry = await writeAsset('assets/runtime.js', `globalThis.__bundleRuntimeRan = true;`);
      globalThis.__bundleRuntimeRan = false;

      const result = await bundleScripts([entry], distClientDir);
      await executeBundle(result.filename);

      expect(result.content).toContain('__bundleRuntimeRan');
      expect(globalThis.__bundleRuntimeRan).toBe(true);
      delete globalThis.__bundleRuntimeRan;
    }, 30_000);

    it('keeps bare module specifiers external', async () => {
      const entry = await writeAsset(
        'assets/external.js',
        `import value from 'l5e-external-test'; globalThis.__external = value;`,
      );

      const result = await bundleScripts([entry], distClientDir);

      expect(result.content).toContain(`from "l5e-external-test"`);
    }, 30_000);

    it('loads lazy dependencies from their original emitted URL', async () => {
      await writeAsset(
        'assets/lazy.js',
        `globalThis.__bundleLazyRuns = (globalThis.__bundleLazyRuns || 0) + 1; export const value = 'lazy-value';`,
      );
      const entry = await writeAsset(
        'assets/main.js',
        `globalThis.__bundleEntryRan = true; globalThis.__loadBundleLazy = () => import('./lazy.js').then((mod) => mod.value);`,
      );
      globalThis.__bundleLazyRuns = 0;
      globalThis.__bundleEntryRan = false;

      const result = await bundleScripts([entry], distClientDir);
      const written = await executeBundle(result.filename);

      expect(result.content).toContain('__bundleEntryRan');
      expect(globalThis.__bundleEntryRan).toBe(true);
      expect(globalThis.__bundleLazyRuns).toBe(0);
      expect([...written]).toHaveLength(1);
      await expect(globalThis.__loadBundleLazy()).resolves.toBe('lazy-value');
      expect(globalThis.__bundleLazyRuns).toBe(1);
      delete globalThis.__bundleLazyRuns;
      delete globalThis.__bundleEntryRan;
      delete globalThis.__loadBundleLazy;
    }, 30_000);
  });

  describe('getBundledFile', () => {
    it('reports a miss for a hash that was never built', () => {
      // The server route turns this into a 404 — bundles only live in memory, so
      // a stale URL from a previous process has nothing to fall back to on disk.
      expect(getBundledFile('bundle-0123456789abcdef.js')).toBeUndefined();
    });

    it('reports a miss after the bundle map is cleared', async () => {
      const alpha = await writeAsset('assets/alpha.js', `globalThis.__alpha = 'alpha-marker';`);
      const { filename } = await bundleScripts([alpha], distClientDir);
      expect(getBundledFile(filename)).toBeDefined();

      clearBundledFiles();

      expect(getBundledFile(filename)).toBeUndefined();
    }, 30_000);

    it('rebuilds after a clear instead of serving a dangling filename', async () => {
      const alpha = await writeAsset('assets/alpha.js', `globalThis.__alpha = 'alpha-marker';`);
      const first = await bundleScripts([alpha], distClientDir);

      clearBundledFiles();
      const second = await bundleScripts([alpha], distClientDir);

      expect(second.filename).toBe(first.filename);
      expect(getBundledFile(second.filename)?.content).toBe(second.content);
    }, 30_000);
  });

  describe('bundleCss', () => {
    it('reads each source file once across concurrent callers', async () => {
      const main = await writeAsset('assets/main.css', '.main{color:red}');
      const extra = await writeAsset('assets/extra.css', '.extra{color:blue}');

      const readFile = vi.spyOn(fs, 'readFile');

      const results = await Promise.all(
        Array.from({ length: 20 }, () => bundleCss([main, extra], distClientDir)),
      );

      const [first] = results;
      expect(first.filename).toMatch(/^bundle-.*\.css$/);
      expect(first.content).toContain('.main{color:red}');
      expect(first.content).toContain('.extra{color:blue}');
      for (const result of results) {
        expect(result.filename).toBe(first.filename);
      }

      // Không dedup thì đây sẽ là 40 lần đọc.
      expect(readFile).toHaveBeenCalledTimes(2);
    });

    it('skips unreadable files without failing the bundle', async () => {
      const main = await writeAsset('assets/main.css', '.main{color:red}');
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await bundleCss([main, '/assets/gone.css'], distClientDir);

      expect(result.filename).toMatch(/^bundle-.*\.css$/);
      expect(result.content).toContain('.main{color:red}');
      expect(result.content).not.toContain('gone.css');
    });
  });
});
