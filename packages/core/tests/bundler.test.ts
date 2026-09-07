import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bundleCss, bundleScripts, clearBundledFiles, getBundledFile } from '../src/core/bundler';

/**
 * Runtime bundling chạy trên đường request nên nhiều request đồng thời có thể
 * cùng trigger một bundle. Bộ test này khoá lại hai tính chất: bundle chạy đúng
 * một lần cho mỗi tập input, và không có file tạm nào trên đĩa để hai lần chạy
 * song song giẫm lên nhau.
 */
describe('bundler', () => {
  let tmpRoot: string;
  let distClientDir: string;

  const writeAsset = async (relativePath: string, content: string) => {
    const absolute = path.join(distClientDir, relativePath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content, 'utf-8');
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
      await fs.writeFile(path.join(executionDir, filename), bundled.content, 'utf-8');

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
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  describe('bundleScripts', () => {
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

      await Promise.all(
        Array.from({ length: 5 }, () => bundleScripts([alpha], distClientDir)),
      );

      // Cả rootDir cũ lẫn cwd đều không được sinh ra thư mục entry tạm nào.
      await expect(fs.stat(path.join(tmpRoot, '.temp-bundle'))).rejects.toThrow();
      await expect(fs.stat(path.join(process.cwd(), '.temp-bundle'))).rejects.toThrow();
      await expect(fs.readdir(distClientDir)).resolves.toEqual(['assets']);
    }, 30_000);

    it('treats different path orderings as the same bundle', async () => {
      const alpha = await writeAsset('assets/alpha.js', `globalThis.__alpha = 'alpha-marker';`);
      const beta = await writeAsset('assets/beta.js', `globalThis.__beta = 'beta-marker';`);

      const [forward, reversed, duplicated] = await Promise.all([
        bundleScripts([alpha, beta], distClientDir),
        bundleScripts([beta, alpha], distClientDir),
        bundleScripts([alpha, beta, alpha], distClientDir),
      ]);

      expect(reversed.filename).toBe(forward.filename);
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

    it('preserves sorted input side effects and executes a shared module once', async () => {
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

      expect(globalThis.__bundleOrder).toEqual(['alpha', 'zeta']);
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
      const entry = await writeAsset(
        'assets/runtime.js',
        `globalThis.__bundleRuntimeRan = true;`,
      );
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

    it('stores and executes lazy chunks while returning the real entry', async () => {
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
      expect([...written]).toHaveLength(2);
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
