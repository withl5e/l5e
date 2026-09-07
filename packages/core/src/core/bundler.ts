/// <reference path="./jsx-types.d.ts" />
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { InputOptions, OutputChunk, OutputOptions, Plugin } from 'rolldown';
import type { ScriptBundlePolicy } from './script-bundle-policy';

let rolldownModulePromise: Promise<typeof import('rolldown')> | null = null;

/**
 * Resolve Rolldown lazily from the installed framework package. A bare static
 * import can be hoisted when the framework is bundled into a consumer's SSR
 * output, which breaks pnpm's strict dependency layout. Anchoring resolution at
 * @withl5e/l5e keeps the runtime dependency owned by the package that declares it.
 */
function loadRolldown(): Promise<typeof import('rolldown')> {
  if (!rolldownModulePromise) {
    rolldownModulePromise = (async () => {
      const require = createRequire(import.meta.url);
      const frameworkEntry = require.resolve('@withl5e/l5e/server');
      const frameworkRequire = createRequire(frameworkEntry);
      const rolldownPath = frameworkRequire.resolve('rolldown');
      return (await import(
        /* @vite-ignore */ pathToFileURL(rolldownPath).href
      )) as typeof import('rolldown');
    })();
  }
  return rolldownModulePromise;
}

interface BundledFile {
  content: string;
  hash: string;
  filename: string;
  mimeType: string;
}

interface BundleResult {
  hash: string;
  filename: string;
  content: string;
}

export interface ScriptBundleOptions {
  compact?: boolean;
  islands?: Array<{ key: string; script: string }>;
  renderer?: string;
  name?: 'global' | 'bundle' | 'shared';
  sharedUrl?: string;
  globalUrl?: string;
  exportScripts?: string[];
}

const EMPTY_RESULT: BundleResult = { hash: '', filename: '', content: '' };

// Memory map để lưu bundled files
const bundledFilesMap = new Map<string, BundledFile>();

/**
 * Single-flight map: cacheKey → promise của lần bundle đang chạy (hoặc đã xong).
 * Vì promise được giữ lại sau khi resolve, map này vừa là in-flight dedup vừa là
 * result cache. Bundle lỗi bị xoá khỏi map để request sau được thử lại.
 */
const bundlePromises = new Map<string, Promise<BundleResult>>();

/**
 * Chạy `work` đúng một lần cho mỗi cacheKey, kể cả khi nhiều request đến đồng thời.
 */
function dedupe(cacheKey: string, work: () => Promise<BundleResult>): Promise<BundleResult> {
  const pending = bundlePromises.get(cacheKey);
  if (pending) {
    return pending;
  }

  const promise = work().catch((error) => {
    bundlePromises.delete(cacheKey);
    throw error;
  });
  bundlePromises.set(cacheKey, promise);
  return promise;
}

/**
 * Generate hash từ content
 */
function generateHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

// Rolldown coi id bắt đầu bằng \0 là virtual — nó sẽ không cố đọc từ đĩa.
const VIRTUAL_ENTRY_ID = '\0l5e:bundle-entry';

/**
 * Entry của mỗi lần bundle chỉ là một danh sách import. Giữ nó trong memory thay
 * vì ghi ra đĩa: hai request đồng thời cùng một tập script sinh ra cùng nội dung
 * entry, nên file tạm dùng chung path sẽ bị request này xoá trong lúc Rolldown của
 * request kia còn đang đọc.
 */
function virtualEntryPlugin(entryContent: string): Plugin {
  return {
    name: 'l5e-virtual-entry',
    resolveId(source) {
      return source === VIRTUAL_ENTRY_ID ? VIRTUAL_ENTRY_ID : null;
    },
    load(id) {
      return id === VIRTUAL_ENTRY_ID ? entryContent : null;
    },
  };
}

/** Inline page roots only; their emitted dependencies retain canonical URLs. */
function preserveBuildChunksPlugin(policy: ScriptBundlePolicy): Plugin {
  return {
    name: 'preserve-build-chunks',
    resolveId(source, importer) {
      if (!importer || source === VIRTUAL_ENTRY_ID) return null;
      const file = path.isAbsolute(source)
        ? path.normalize(source)
        : source.startsWith('.')
          ? path.resolve(path.dirname(importer), source)
          : null;
      if (!file) return null;
      // The virtual entry is the only place where an unshared page entry may
      // be inlined. Never traverse an emitted dependency to re-bundle its body.
      if (importer === VIRTUAL_ENTRY_ID && !policy.isPreserved(file)) return null;
      return { id: policy.assetUrl(file), external: 'absolute' };
    },
  };
}

function compactBuildPlugin(
  policy: ScriptBundlePolicy,
  sharedUrl?: string,
  globalUrl?: string,
): Plugin {
  return {
    name: 'compact-build-graph',
    resolveId(source, importer) {
      if (!importer || source === VIRTUAL_ENTRY_ID) return null;
      const file = path.isAbsolute(source)
        ? path.normalize(source)
        : source.startsWith('/')
          ? policy.fileForAssetUrl(source)
        : source.startsWith('.')
          ? path.resolve(path.dirname(importer), source)
          : null;
      if (!file) return null;
      return policy.isShared(file) && sharedUrl
        ? { id: sharedUrl, external: 'absolute' }
        : policy.isGlobalOwned(file) && globalUrl
          ? { id: globalUrl, external: 'absolute' }
        : { id: file };
    },
  };
}

async function runScriptBundle(
  uniquePaths: string[],
  policy: ScriptBundlePolicy,
  options: ScriptBundleOptions = {},
): Promise<BundleResult> {
  const roots = uniquePaths.map((p) => policy.fileForScript(p));
  const compact = options.compact && policy.compact;
  const suffix = policy.inlineableRoots(roots);
  const prefixChunks = new Map(
    roots.flatMap((file, index) =>
      !policy.isPreserved(file) && !suffix.has(file) ? [[file, `entry-${index}`] as const] : [],
    ),
  );
  const islands = (options.islands || []).map(({ key, script }) => ({
    key,
    file: policy.fileForScript(script),
  }));
  const renderer = options.renderer ? policy.fileForScript(options.renderer) : undefined;
  const exportFiles = (options.exportScripts || []).map((script) => policy.fileForScript(script));
  const entryContent = [
    ...roots.map((filePath) =>
      options.name === 'shared'
        ? `export * from ${JSON.stringify(filePath)};`
        : `import ${JSON.stringify(filePath)};`,
    ),
    ...exportFiles.map((filePath) => `export * from ${JSON.stringify(filePath)};`),
    ...(islands.length
      ? [
          'globalThis.__L5E_ISLANDS__ ||= {};',
          ...islands.map(
            ({ key, file }) =>
              `globalThis.__L5E_ISLANDS__[${JSON.stringify(key)}] = async () => { const [renderer, module] = await Promise.all([import(${JSON.stringify(renderer)}), import(${JSON.stringify(file)})]); return { reactDomClient: renderer.reactDomClient, createElement: renderer.createElement, module }; };`,
          ),
          'globalThis.__L5E_BOOT_ISLANDS__?.();',
        ]
      : []),
  ].join('\n');

  const rolldownOptions: InputOptions = {
    input: VIRTUAL_ENTRY_ID,
    plugins: [
      virtualEntryPlugin(entryContent),
      compact
        ? compactBuildPlugin(policy, options.sharedUrl, options.globalUrl)
        : preserveBuildChunksPlugin(policy),
    ],
    platform: 'neutral',
    tsconfig: false,
    // Runtime scripts are imported for their side effects. Do not let an app's
    // package.json sideEffects flag erase those entry imports.
    // Rolldown 1.2 still consults package metadata for boolean `true`, so use
    // an explicit callback to override consumer `sideEffects: false`.
    treeshake: { moduleSideEffects: () => true },
    external: (id) => {
      // External node_modules
      if (!id.startsWith('.') && !path.isAbsolute(id) && id !== VIRTUAL_ENTRY_ID) {
        return true;
      }

      // Emitted file imports are resolved by preserveBuildChunksPlugin.
      return false;
    },
  };

  const outputOptions: OutputOptions = {
    format: 'es',
    codeSplitting: compact
      ? false
      : { groups: [{ name: (id) => prefixChunks.get(id) ?? null }] },
    minify: false,
    entryFileNames: `${options.name || 'bundle'}-[hash].js`,
    strictExecutionOrder: compact,
    chunkFileNames: `bundle-${generateHash(JSON.stringify(roots))}-[hash].js`,
  };

  const { rolldown } = await loadRolldown();
  const bundle = await rolldown(rolldownOptions);
  let output;
  try {
    ({ output } = await bundle.generate(outputOptions));
  } finally {
    await bundle.close();
  }

  for (const chunk of output) {
    if (chunk.type !== 'chunk') {
      continue;
    }
    bundledFilesMap.set(chunk.fileName, {
      content: chunk.code || '',
      hash: generateHash(chunk.code || ''),
      filename: chunk.fileName,
      mimeType: 'application/javascript',
    });
  }

  const entryChunk = output.find(
    (item): item is OutputChunk =>
      item.type === 'chunk' && item.isEntry && item.facadeModuleId === VIRTUAL_ENTRY_ID,
  );
  if (!entryChunk) {
    throw new Error('[bundler] rolldown produced no entry chunk');
  }

  return {
    hash: generateHash(entryChunk.code || ''),
    filename: entryChunk.fileName,
    content: entryChunk.code || '',
  };
}

/**
 * Bundle JavaScript files từ dist/client thành 1 file
 * Trong production, các file đã được build sẵn trong dist/client
 */
export async function bundleScripts(
  scriptPaths: string[],
  distClientDir: string,
  policy?: ScriptBundlePolicy,
  options: ScriptBundleOptions = {},
): Promise<BundleResult> {
  if (scriptPaths.length === 0) {
    return EMPTY_RESULT;
  }

  if (!policy || policy.directory !== path.resolve(distClientDir)) {
    console.warn('[bundler] No matching build manifest; serving original script entries.');
    return EMPTY_RESULT;
  }

  const uniquePaths = [...new Set(scriptPaths)];
  const cacheKey = `scripts:${policy.cacheKey}:${JSON.stringify([uniquePaths, options])}`;

  try {
    return await dedupe(cacheKey, () => runScriptBundle(uniquePaths, policy, options));
  } catch (error) {
    console.error('[bundler] Error bundling scripts:', error);
    return EMPTY_RESULT;
  }
}

async function runCssBundle(uniquePaths: string[], distClientDir: string): Promise<BundleResult> {
  const cssContents: string[] = [];

  for (const cssPath of uniquePaths) {
    // cssPath có thể là "/assets/xxx.css" hoặc từ manifest
    const filePath = cssPath.startsWith('/')
      ? path.join(distClientDir, cssPath.substring(1))
      : path.join(distClientDir, cssPath);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      cssContents.push(`/* ${cssPath} */\n${content}\n`);
    } catch (err) {
      console.warn(`[bundler] Failed to read CSS file: ${cssPath}`, err);
    }
  }

  const bundledContent = cssContents.join('\n\n');
  const hash = generateHash(bundledContent);
  const filename = `bundle-${hash}.css`;

  bundledFilesMap.set(filename, {
    content: bundledContent,
    hash,
    filename,
    mimeType: 'text/css',
  });

  return { hash, filename, content: bundledContent };
}

/**
 * Bundle CSS files từ dist/client thành 1 file
 * Trong production, các file đã được build sẵn trong dist/client
 */
export async function bundleCss(cssPaths: string[], distClientDir: string): Promise<BundleResult> {
  if (cssPaths.length === 0) {
    return EMPTY_RESULT;
  }

  const uniquePaths = [...new Set(cssPaths)].sort();
  const cacheKey = `css:${JSON.stringify([path.resolve(distClientDir), uniquePaths])}`;

  try {
    return await dedupe(cacheKey, () => runCssBundle(uniquePaths, distClientDir));
  } catch (error) {
    console.error('[bundler] Error bundling CSS:', error);
    return EMPTY_RESULT;
  }
}

/**
 * Get bundled file từ map
 */
export function getBundledFile(filename: string): BundledFile | undefined {
  return bundledFilesMap.get(filename);
}

/**
 * Clear bundled files map (useful for testing)
 */
export function clearBundledFiles(): void {
  bundledFilesMap.clear();
  bundlePromises.clear();
}
