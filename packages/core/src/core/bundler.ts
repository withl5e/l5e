/// <reference path="./jsx-types.d.ts" />
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { rollup, type OutputOptions, type RollupOptions } from 'rollup';

interface BundledFile {
  content: string;
  hash: string;
  filename: string;
  mimeType: string;
}

// Memory map để lưu bundled files
const bundledFilesMap = new Map<string, BundledFile>();

// Cache map để deduplicate bundling requests (cacheKey → entry chunk fileName)
const bundleCache = new Map<string, string>();
const cssCache = new Map<string, string>();

/**
 * Generate hash từ content
 */
function generateHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Bundle JavaScript files từ dist/client thành 1 file
 * Trong production, các file đã được build sẵn trong dist/client
 */
export async function bundleScripts(
  scriptPaths: string[],
  rootDir: string,
  distClientDir: string,
): Promise<{ hash: string; filename: string; content: string }> {
  if (scriptPaths.length === 0) {
    return { hash: '', filename: '', content: '' };
  }

  // Dedupe paths (remove duplicates)
  const uniquePaths = [...new Set(scriptPaths)];

  // Tạo cache key từ sorted unique paths
  const cacheKey = `scripts:${uniquePaths.sort().join(',')}`;

  // Kiểm tra cache - return entry chunk info if already bundled
  const cachedEntryFileName = bundleCache.get(cacheKey);
  if (cachedEntryFileName) {
    const entryFile = bundledFilesMap.get(cachedEntryFileName);
    if (entryFile) {
      return {
        hash: entryFile.hash,
        filename: entryFile.filename,
        content: entryFile.content,
      };
    }
  }

  // Temp file path for cleanup
  let entryFile: string | null = null;

  try {
    // Sử dụng rollup để bundle nếu cần (resolve imports, etc)
    // Tạo temp entry file
    const hash = generateHash(uniquePaths.join('\n'));
    const tempDir = path.join(rootDir, '.temp-bundle');
    await fs.mkdir(tempDir, { recursive: true }).catch(() => {});

    entryFile = path.join(tempDir, `entry-${hash}.js`);
    // Tạo entry file import tất cả scripts
    const entryContent = uniquePaths
      .map((p, i) => {
        const filePath = p.startsWith('/')
          ? path.join(distClientDir, p.substring(1))
          : path.join(distClientDir, p);
        return `import ${JSON.stringify(filePath)};`;
      })
      .join('\n');

    await fs.writeFile(entryFile, entryContent, 'utf-8');
    console.log(`[bundler] Wrote entry file to ${entryFile}`);
    console.log(`[bundler] Entry content: ${entryContent}`);
    // Rollup config để bundle
    const rollupOptions: RollupOptions = {
      input: entryFile,
      plugins: [
        {
          name: 'vendor-path-rewriter',
          resolveId(source, importer, _options) {
            // Handle vendor/chunk/global files: convert absolute paths to web paths
            // Global files (*.global.*) are already loaded by client.global.ts —
            // re-bundling them would create duplicate module instances (e.g. nanostores)
            if (
              source.includes('vendor-') ||
              source.includes('chunk-') ||
              source.includes('.global')
            ) {
              console.log(`[bundler] Resolving source: ${source}`);
              if (path.isAbsolute(source)) {
                console.log(`[bundler] Resolving absolute path: ${source}`);
                // e.g., C:\...\dist\client\assets\vendor-react-XXX.js -> /assets/vendor-react-XXX.js
                const relativePath = path.relative(distClientDir, source);
                const webPath = '/' + relativePath.replace(/\\/g, '/');
                return { id: webPath, external: true };
              } else if (importer && source.startsWith('.')) {
                console.log(
                  `[bundler] Resolving relative path: ${source} from importer: ${importer}`,
                );
                // Relative path like ./auth.global-BOVr81Z5.js — resolve from importer
                const resolved = path.resolve(path.dirname(importer), source);
                const relativePath = path.relative(distClientDir, resolved);
                const webPath = '/' + relativePath.replace(/\\/g, '/');
                return { id: webPath, external: true };
              } else {
                console.log(`[bundler] Resolving source: ${source}`);
              }
            }
            return null; // Let other plugins/external handle
          },
        },
      ],
      external: (id) => {
        // External node_modules
        if (!id.startsWith('.') && !path.isAbsolute(id)) {
          return true;
        }

        // Let plugin handle vendor/chunk/global files (don't mark external here)
        if (id.includes('vendor-') || id.includes('chunk-') || id.includes('.global')) {
          return false; // Let plugin's resolveId handle path rewriting
        }

        return false;
      },
    };

    const outputOptions: OutputOptions = {
      format: 'es',
      inlineDynamicImports: false,
      entryFileNames: 'bundle-[hash].js',
      chunkFileNames: 'bundle-[hash].js',
    };

    const bundle = await rollup(rollupOptions);
    const { output } = await bundle.generate(outputOptions);
    await bundle.close();

    // Lấy bundled content từ rollup

    output.forEach((o) => {
      if (o.type !== 'chunk') {
        return;
      }
      // Lưu vào map với key = fileName
      const bundledFile: BundledFile = {
        content: o.code || '',
        hash: generateHash(o.code || ''),
        filename: o.fileName,
        mimeType: 'application/javascript',
      };
      bundledFilesMap.set(o.fileName, bundledFile);
    });

    // Cache entry chunk fileName for deduplication
    const entryChunk = output[0];
    if (entryChunk?.type === 'chunk') {
      bundleCache.set(cacheKey, entryChunk.fileName);
    }

    // Return entry chunk info
    return {
      hash: generateHash(output[0]?.code || ''),
      filename: output[0]?.fileName || '',
      content: output[0]?.code || '',
    };
  } catch (error) {
    console.error('[bundler] Error bundling scripts:', error);
    return { hash: '', filename: '', content: '' };
  } finally {
    // Cleanup temp entry file
    if (entryFile) {
      await fs.unlink(entryFile).catch(() => {
        // Ignore cleanup errors
      });
    }
  }
}

/**
 * Bundle CSS files từ dist/client thành 1 file
 * Trong production, các file đã được build sẵn trong dist/client
 */
export async function bundleCss(
  cssPaths: string[],
  rootDir: string,
  distClientDir: string,
): Promise<{ hash: string; filename: string; content: string }> {
  if (cssPaths.length === 0) {
    return { hash: '', filename: '', content: '' };
  }

  // Dedupe paths (remove duplicates)
  const uniquePaths = [...new Set(cssPaths)];

  // Tạo cache key từ sorted unique paths
  const cacheKey = `css:${uniquePaths.sort().join(',')}`;

  // Kiểm tra cache - return cached file if already bundled
  const cachedFileName = cssCache.get(cacheKey);
  if (cachedFileName) {
    const cachedFile = bundledFilesMap.get(cachedFileName);
    if (cachedFile) {
      return {
        hash: cachedFile.hash,
        filename: cachedFile.filename,
        content: cachedFile.content,
      };
    }
  }

  try {
    // Đọc và gộp tất cả CSS files từ dist/client
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

    // Lưu vào map với key = filename
    const bundledFile: BundledFile = {
      content: bundledContent,
      hash,
      filename,
      mimeType: 'text/css',
    };
    bundledFilesMap.set(filename, bundledFile);

    // Cache filename for deduplication
    cssCache.set(cacheKey, filename);

    return { hash, filename, content: bundledContent };
  } catch (error) {
    console.error('[bundler] Error bundling CSS:', error);
    return { hash: '', filename: '', content: '' };
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
}
