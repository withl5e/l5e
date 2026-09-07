import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import type { Manifest } from 'vite';
import { withAssetBase } from './global-style';

/** Preserve the emitted module boundaries chosen by the application's build. */
export interface ChunkingReport {
  mode?: string;
  chunks?: Array<{
    file: string;
    kind: string;
    canonicalShared?: boolean;
    canonicalGlobal?: boolean;
  }>;
}

export function createScriptBundlePolicy(
  manifest: Manifest,
  distClientDir: string,
  base = '/',
  report?: ChunkingReport,
) {
  const directory = path.resolve(distClientDir);
  // Rolldown resolves entry importers through symlinks/junctions. Use the same
  // physical directory for identity while retaining the caller's output scope.
  const assetDirectory = realpathSync(directory);
  const files = new Set<string>();
  const preserved = new Set<string>();
  const staticImports = new Map<string, string[]>();
  const jsEntries = Object.entries(manifest).filter(([, entry]) => /\.[cm]?js$/.test(entry.file));

  function absoluteFile(file: string) {
    const absolute = path.resolve(assetDirectory, file);
    const relative = path.relative(assetDirectory, absolute);
    if (
      !relative ||
      relative === '..' ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    ) {
      throw new Error(`[bundler] Asset is outside the client output: ${file}`);
    }
    return absolute;
  }

  const shared = new Set(
    (report?.chunks || [])
      .filter((chunk) => report?.mode === 'compact' && chunk.canonicalShared)
      .map((chunk) => absoluteFile(chunk.file)),
  );
  const globalOwned = new Set(
    (report?.chunks || [])
      .filter((chunk) => report?.mode === 'compact' && chunk.canonicalGlobal)
      .map((chunk) => absoluteFile(chunk.file)),
  );

  for (const [key, entry] of jsEntries) {
    const file = absoluteFile(entry.file);
    files.add(file);
    if (
      !entry.isEntry ||
      entry.isDynamicEntry ||
      key === 'src/client.global.ts' ||
      /(?:^|\/)react\//.test(entry.src || key)
    )
      preserved.add(file);
  }

  // Index the whole build, not just this request's roots. This also protects an
  // entry imported by another entry, even when both are selected on this page.
  for (const [, entry] of jsEntries) {
    for (const key of [...(entry.imports || []), ...(entry.dynamicImports || [])]) {
      const dependency = manifest[key];
      if (!dependency || !files.has(absoluteFile(dependency.file))) {
        throw new Error(`[bundler] Missing JavaScript manifest dependency: ${key}`);
      }
      preserved.add(absoluteFile(dependency.file));
    }
    staticImports.set(
      absoluteFile(entry.file),
      (entry.imports || []).map((key) => absoluteFile(manifest[key].file)),
    );
  }

  const cacheKey = createHash('sha256')
    .update(JSON.stringify([directory, assetDirectory, base, manifest]))
    .digest('hex');

  return {
    cacheKey,
    compact: report?.mode === 'compact',
    directory,
    fileForScript(script: string) {
      const normalizedBase = base === '/' ? '/' : `/${base.replace(/^\/+|\/+$/g, '')}/`;
      const relative = script.startsWith(normalizedBase)
        ? script.slice(normalizedBase.length)
        : script.replace(/^\/+/, '');
      const file = absoluteFile(relative);
      if (!files.has(file)) throw new Error(`[bundler] Script is missing from manifest: ${script}`);
      return file;
    },
    fileForAssetUrl(url: string) {
      const normalizedBase = base === '/' ? '/' : `/${base.replace(/^\/+|\/+$/g, '')}/`;
      const relative = url.startsWith(normalizedBase)
        ? url.slice(normalizedBase.length)
        : url.replace(/^\/+/, '');
      const file = absoluteFile(relative);
      return files.has(file) ? file : undefined;
    },
    isPreserved(file: string) {
      return preserved.has(file);
    },
    isShared(file: string) {
      return shared.has(file);
    },
    isGlobalOwned(file: string) {
      return globalOwned.has(file);
    },
    sharedScripts() {
      return [...shared].map((file) =>
        withAssetBase(base, path.relative(assetDirectory, file).replace(/\\/g, '/')),
      );
    },
    globalOwnedScripts() {
      return [...globalOwned].map((file) =>
        withAssetBase(base, path.relative(assetDirectory, file).replace(/\\/g, '/')),
      );
    },
    inlineableRoots(roots: string[]) {
      // External ESM imports execute before any inlined body. Isolate prefix
      // roots in runtime chunks when a later root introduces a dependency effect;
      // only the suffix after the last such boundary can share the entry chunk.
      const visited = new Set<string>();
      let suffixStart = 0;
      function visit(file: string, rootIndex: number) {
        if (visited.has(file)) return;
        visited.add(file);
        for (const dependency of staticImports.get(file) || []) visit(dependency, rootIndex);
        if (preserved.has(file)) suffixStart = rootIndex;
      }
      roots.forEach((file, index) => {
        visit(file, index);
        if (preserved.has(file)) suffixStart = index + 1;
      });
      return new Set(roots.slice(suffixStart).filter((file) => !preserved.has(file)));
    },
    assetUrl(file: string) {
      if (!files.has(file)) throw new Error(`[bundler] Import is missing from manifest: ${file}`);
      return withAssetBase(base, path.relative(assetDirectory, file).replace(/\\/g, '/'));
    },
  };
}

export type ScriptBundlePolicy = ReturnType<typeof createScriptBundlePolicy>;
