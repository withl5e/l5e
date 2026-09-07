import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import type { Manifest } from 'vite';
import { withAssetBase } from './global-style';

/** Preserve the emitted module boundaries chosen by the application's build. */
export function createScriptBundlePolicy(manifest: Manifest, distClientDir: string, base = '/') {
  const directory = path.resolve(distClientDir);
  // Rolldown resolves entry importers through symlinks/junctions. Use the same
  // physical directory for identity while retaining the caller's output scope.
  const assetDirectory = realpathSync(directory);
  const files = new Set<string>();
  const preserved = new Set<string>();
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
  }

  const cacheKey = createHash('sha256')
    .update(JSON.stringify([directory, assetDirectory, base, manifest]))
    .digest('hex');

  return {
    cacheKey,
    directory,
    fileForScript(script: string) {
      const file = absoluteFile(script.replace(/^\/+/, ''));
      if (!files.has(file)) throw new Error(`[bundler] Script is missing from manifest: ${script}`);
      return file;
    },
    isPreserved(file: string) {
      return preserved.has(file);
    },
    assetUrl(file: string) {
      if (!files.has(file)) throw new Error(`[bundler] Import is missing from manifest: ${file}`);
      return withAssetBase(base, path.relative(assetDirectory, file).replace(/\\/g, '/'));
    },
  };
}

export type ScriptBundlePolicy = ReturnType<typeof createScriptBundlePolicy>;
