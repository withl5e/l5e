import { transform } from 'esbuild';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { dirname, join, relative, resolve } from 'path';
import type { Plugin, UserConfig } from 'vite';

const VIRTUAL_L5E_VIEWS = 'virtual:l5e-views';
const VIRTUAL_L5E_ROUTE = 'virtual:l5e-route';
const VIRTUAL_L5E_SSR_ENTRY = 'virtual:l5e-ssr-entry';
const VIRTUAL_L5E_GLOBAL_LOADER = 'virtual:l5e-global-loader';
const VIRTUAL_L5E_ISLAND_STRATEGIES = 'virtual:l5e-island-strategies';
const VIRTUAL_L5E_ISLANDS = 'virtual:l5e-islands';
const VIRTUAL_L5E_ACTIONS = 'virtual:l5e-actions';
const VIRTUAL_L5E_MIDDLEWARE = 'virtual:l5e-middleware';

/**
 * Vite's built-in env vars on `import.meta.env`. These are statically replaced
 * by Vite itself (DEV/PROD/SSR are booleans, MODE/BASE_URL strings), so the SSR
 * `import.meta.env.* -> process.env.*` rewrite must skip them — otherwise it
 * clobbers Vite defaults (e.g. `import.meta.env.DEV` would become the undefined
 * `process.env.DEV`).
 */
const VITE_RESERVED_ENV = new Set(['MODE', 'BASE_URL', 'PROD', 'DEV', 'SSR', 'LEGACY']);

/**
 * Recursively scan directory for .tsx and .ts files
 */
function scanTsFiles(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir);

  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules and dist directories
      if (file === 'node_modules' || file === 'dist' || file === '.git') {
        continue;
      }
      scanTsFiles(filePath, fileList);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  }

  return fileList;
}

/**
 * Short hash function for island keys
 */
function shortHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).slice(0, 4);
}

/**
 * Derive component name from path: "./react/Counter" â†’ "Counter"
 */
function deriveComponentName(fromPath: string): string {
  const segments = fromPath.split('/');
  let filename = segments[segments.length - 1];
  // Remove extension if present
  filename = filename.replace(/\.(tsx?|jsx?)$/, '');
  return filename;
}

/**
 * Create island registry key: "/src/views/test-island/react/Counter" â†’ "Counter_a3f2"
 */
function makeIslandKey(resolvedPath: string): string {
  const name = deriveComponentName(resolvedPath);
  return `${name}_${shortHash(resolvedPath)}`;
}

/**
 * Resolve file path with extension (.tsx, .ts, .jsx, .js)
 * Returns the relative path with extension (e.g., "src/views/.../Counter.tsx")
 * or null if file not found
 */
function resolveWithExtension(resolvedPath: string, rootDir: string): string | null {
  // resolvedPath: "/src/views/test-island/react/Counter" (no extension, leading /)
  const relPath = resolvedPath.replace(/^\//, ''); // "src/views/.../Counter"
  const absBase = resolve(rootDir, relPath);

  // Check with extensions
  for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
    if (existsSync(absBase + ext)) {
      return relPath + ext; // "src/views/.../Counter.tsx"
    }
  }
  // Check without extension (file might already have one)
  if (existsSync(absBase)) {
    return relPath;
  }
  return null;
}

/**
 * Extract island entries from file using regex on JSX source
 */
function extractIslandEntries(
  filePath: string,
  rootDir: string,
): Array<{ component: string; resolvedPath: string; src: string; key: string }> {
  const content = readFileSync(filePath, 'utf-8');
  const entries: Array<{ component: string; resolvedPath: string; src: string; key: string }> = [];

  // Regex scan JSX source (NOT post-transform code).
  // Just find <ClientIsland ... from="Y" ...> â€” component name derived from path.
  const regex = /<ClientIsland\s[^>]*?from\s*=\s*"([^"]+)"/g;

  const seen = new Set<string>();
  let match;

  while ((match = regex.exec(content)) !== null) {
    const fromPath = match[1];

    // Resolve relative path â†’ absolute
    let resolvedPath: string;
    if (fromPath.startsWith('~/')) {
      // Alias ~/  â†’ /src/ (project convention)
      resolvedPath = '/src/' + fromPath.substring(2);
    } else if (fromPath.startsWith('/src/')) {
      resolvedPath = fromPath;
    } else if (fromPath.startsWith('./') || fromPath.startsWith('../')) {
      const abs = resolve(filePath, '..', fromPath);
      resolvedPath = '/' + relative(rootDir, abs).replace(/\\/g, '/');
    } else {
      resolvedPath = fromPath;
    }

    // Resolve file extension for manifest compatibility
    const src = resolveWithExtension(resolvedPath, rootDir);
    if (!src) {
      console.warn(
        `[l5e] Island component not found: ${resolvedPath} (from ${fromPath} in ${filePath})`,
      );
      continue;
    }

    const key = makeIslandKey(resolvedPath);
    if (!seen.has(key)) {
      seen.add(key);
      entries.push({
        component: deriveComponentName(resolvedPath),
        resolvedPath,
        src, // "src/views/.../Counter.tsx" â€” matches manifest key format
        key,
      });
    }
  }
  return entries;
}

/**
 * Extract paths from useCss and useClientJs calls using regex
 */
function extractPathsFromFile(filePath: string, rootDir: string): { css: string[]; js: string[] } {
  const content = readFileSync(filePath, 'utf-8');
  const css: string[] = [];
  const js: string[] = [];

  // Regex patterns to match useCss('path') or useCss("path")
  // Handles single and double quotes, and escaped quotes
  const useCssPattern = /useCss\s*\(\s*['"]([^'"]+)['"]\s*,?\s*\)/g;
  const useClientJsPattern = /useClientJs\s*\(\s*['"]([^'"]+)['"]\s*,?\s*\)/g;

  let match;

  // Extract CSS paths
  while ((match = useCssPattern.exec(content)) !== null) {
    const path = match[1];
    // Convert relative path to absolute if needed
    if (path.startsWith('/src/')) {
      css.push(path);
    } else if (path.startsWith('./') || path.startsWith('../')) {
      // Resolve relative path
      const absolutePath = resolve(filePath, '..', path);
      const relativePath = '/' + relative(rootDir, absolutePath).replace(/\\/g, '/');
      css.push(relativePath);
    } else {
      css.push(path);
    }
  }

  // Extract JS paths
  while ((match = useClientJsPattern.exec(content)) !== null) {
    const path = match[1];
    if (path.startsWith('/src/')) {
      js.push(path);
    } else if (path.startsWith('./') || path.startsWith('../')) {
      const absolutePath = resolve(filePath, '..', path);
      const relativePath = '/' + relative(rootDir, absolutePath).replace(/\\/g, '/');
      js.push(relativePath);
    } else {
      js.push(path);
    }
  }

  return { css, js };
}

/**
 * Auto-discover rollup input entries from useCss and useClientJs calls
 */
function discoverRollupInput(rootDir: string): {
  input: Record<string, string>;
  islandRegistry: Map<string, string>;
  pathToKey: Map<string, string>;
  keyToSrc: Map<string, string>;
  actionRegistry: Map<string, { modulePath: string; actionName: string }>;
} {
  const input: Record<string, string> = {};
  const srcDir = join(rootDir, 'src');

  // Island registries
  const islandRegistry = new Map<string, string>(); // key â†’ resolvedPath
  const pathToKey = new Map<string, string>(); // resolvedPath â†’ key
  const keyToSrc = new Map<string, string>(); // key â†’ src (manifest-compatible path with extension)

  // Action registry: actionKey â†’ { modulePath, actionName }
  const actionRegistry = new Map<string, { modulePath: string; actionName: string }>();

  try {
    // Check if src directory exists
    if (!statSync(srcDir).isDirectory()) {
      return { input, islandRegistry, pathToKey, keyToSrc, actionRegistry };
    }

    // Check if src/client.global.ts exists and add it as an entry
    const globalTsPath = join(rootDir, 'src', 'client.global.ts');
    if (existsSync(globalTsPath)) {
      input['global'] = globalTsPath;
      console.log('[l5e] Detected src/client.global.ts and added as entry');
    }

    // Scan all .tsx and .ts files
    const tsFiles = scanTsFiles(srcDir);

    // Extract all paths
    const allCssPaths = new Set<string>();
    const allJsPaths = new Set<string>();

    for (const file of tsFiles) {
      const { css, js } = extractPathsFromFile(file, rootDir);
      css.forEach((path) => allCssPaths.add(path));
      js.forEach((path) => allJsPaths.add(path));

      // Extract island entries
      const islandEntries = extractIslandEntries(file, rootDir);
      for (const entry of islandEntries) {
        islandRegistry.set(entry.key, entry.resolvedPath);
        pathToKey.set(entry.resolvedPath, entry.key);
        keyToSrc.set(entry.key, entry.src);
      }

      // Extract action entries from actions.ts/tsx files
      const normalizedFile = file.replace(/\\/g, '/');
      if (/\/actions\.(ts|tsx)$/.test(normalizedFile)) {
        const content = readFileSync(file, 'utf-8');
        const actionExportRegex = /export\s+const\s+(\w+)\s*=\s*defineAction\s*\(/g;
        let actionMatch;

        // Compute modulePath: relative path from src/ to parent dir
        const relFromSrc = relative(srcDir, dirname(file)).replace(/\\/g, '/');
        const modulePath = relFromSrc || '.';

        while ((actionMatch = actionExportRegex.exec(content)) !== null) {
          const actionName = actionMatch[1];
          const actionKey = `${actionName}_${shortHash(modulePath)}`;
          actionRegistry.set(actionKey, { modulePath, actionName });
        }
      }
    }

    // Convert paths to rollup input entries
    // CSS files
    for (const cssPath of allCssPaths) {
      // Remove leading /src/ and convert to relative path
      const relativePath = cssPath.startsWith('/src/')
        ? cssPath.substring(1) // Remove leading /
        : cssPath.startsWith('/')
          ? cssPath.substring(1)
          : cssPath;

      const absolutePath = resolve(rootDir, relativePath);

      // Only add if file exists
      if (!existsSync(absolutePath)) {
        console.warn(`[l5e] CSS file not found: ${absolutePath} (from ${cssPath})`);
        continue;
      }

      // Generate entry name from path (e.g., /src/views/home/home.css -> views-home-home)
      const entryName = relativePath
        .replace(/^src\//, '')
        .replace(/\.css$/, '')
        .replace(/\//g, '-')
        .replace(/\\/g, '-');

      input[entryName] = absolutePath;
    }

    // JS/TS files
    for (const jsPath of allJsPaths) {
      const relativePath = jsPath.startsWith('/src/')
        ? jsPath.substring(1)
        : jsPath.startsWith('/')
          ? jsPath.substring(1)
          : jsPath;

      const absolutePath = resolve(rootDir, relativePath);

      // Only add if file exists
      if (!existsSync(absolutePath)) {
        console.warn(`[l5e] JS/TS file not found: ${absolutePath} (from ${jsPath})`);
        continue;
      }

      // Generate entry name from path
      const entryName = relativePath
        .replace(/^src\//, '')
        .replace(/\.(ts|tsx|js|jsx)$/, '')
        .replace(/\//g, '-')
        .replace(/\\/g, '-');

      input[entryName] = absolutePath;
    }

    // Add island component files to rollup input so they appear in manifest.
    // server.ts looks up manifest at runtime to resolve per-page island URLs.
    for (const [key, src] of keyToSrc) {
      const absolutePath = resolve(rootDir, src);
      input[`island-${key}`] = absolutePath;
    }

    if (islandRegistry.size > 0) {
      console.log(`[l5e] Detected ${islandRegistry.size} island(s)`);
    }
    if (actionRegistry.size > 0) {
      console.log(`[l5e] Detected ${actionRegistry.size} action(s)`);
    }
  } catch (error) {
    // Silently fail if directory doesn't exist or other errors
    console.warn('[l5e] Failed to discover rollup input:', error);
  }

  return { input, islandRegistry, pathToKey, keyToSrc, actionRegistry };
}

/**
 * Inject __key prop into ClientIsland calls
 * Use anchor-based approach to avoid fragile regex with nested objects
 */
function injectIslandKeys(
  code: string,
  fileId: string,
  rootDir: string,
  pathToKey: Map<string, string>,
  keyToSrc: Map<string, string>,
): string {
  // After esbuild, code has form:
  // jsxFactory(ClientIsland, { from: "./react/Counter", props: { n: 5 } })
  //            ^anchor          ^find from here

  const result: string[] = [];
  let lastIndex = 0;

  // Find each position "ClientIsland," (anchor)
  const anchorRegex = /ClientIsland\s*,\s*\{/g;
  let anchorMatch;

  while ((anchorMatch = anchorRegex.exec(code)) !== null) {
    const searchStart = anchorMatch.index + anchorMatch[0].length;

    // Scan for from: "..." in window ~500 chars after anchor
    const window = code.substring(searchStart, searchStart + 500);
    const fromMatch = /from:\s*"([^"]+)"/.exec(window);

    if (!fromMatch) continue;

    const fromPath = fromMatch[1];

    // Resolve path (handle ~/ alias)
    let resolved: string;
    if (fromPath.startsWith('~/')) {
      resolved = '/src/' + fromPath.substring(2);
    } else if (fromPath.startsWith('/src/')) {
      resolved = fromPath;
    } else if (fromPath.startsWith('./') || fromPath.startsWith('../')) {
      const abs = resolve(fileId, '..', fromPath);
      resolved = '/' + relative(rootDir, abs).replace(/\\/g, '/');
    } else {
      resolved = fromPath;
    }

    const key = pathToKey.get(resolved);
    if (!key) continue;

    const src = keyToSrc.get(key);
    if (!src) continue;

    // Inject __key and __src right after from: "..."
    const insertPos = searchStart + fromMatch.index + fromMatch[0].length;
    result.push(code.substring(lastIndex, insertPos));
    result.push(`, __key: "${key}", __src: "${src}"`);
    lastIndex = insertPos;
  }

  result.push(code.substring(lastIndex));
  return result.join('');
}

export function coreVite(): Plugin {
  let rootDir: string = process.cwd();
  let islandRegistry = new Map<string, string>();
  let pathToKey = new Map<string, string>();
  let keyToSrc = new Map<string, string>();
  let actionRegistry = new Map<string, { modulePath: string; actionName: string }>();

  return {
    name: 'l5e-jsx-classic',
    enforce: 'pre',

    configResolved(resolvedConfig) {
      // Store root directory for later use
      rootDir = resolvedConfig.root || process.cwd();
    },

    handleHotUpdate({ file, server }) {
      const relPath = relative(rootDir, file);

      // Re-scan action registry when an actions file changes
      if (/actions\.(ts|tsx)$/.test(file)) {
        const discovered = discoverRollupInput(rootDir);
        actionRegistry = discovered.actionRegistry;
        // Invalidate the virtual:l5e-actions module so server picks up new registry
        const mod = server.moduleGraph.getModuleById('\0' + VIRTUAL_L5E_ACTIONS);
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
        }
        console.log(
          `[l5e] Action file changed: ${relPath} â€” re-scanned ${actionRegistry.size} action(s)`,
        );
      }

      // Allow Vite's default HMR for CSS and client-side JS files
      if (file.endsWith('.css')) {
        console.log(`[l5e] CSS changed: ${relPath} - using Vite HMR`);
        return; // Let Vite handle CSS HMR
      }

      if (file.includes('client.ts')) {
        console.log(`[l5e] Client JS changed: ${relPath} - using Vite HMR`);
        return; // Let Vite handle client JS HMR
      }

      // Trigger full page reload for SSR-related file changes (components, loaders, routes)
      // This ensures that server-side rendered components update properly
      if (file.includes('/src/') || file.includes('\\src\\')) {
        console.log(`[l5e] SSR file changed: ${relPath} - triggering full reload`);
        server.ws.send({
          type: 'full-reload',
          path: '*',
        });
        return []; // Prevent Vite's default HMR behavior
      }
    },

    buildEnd() {
      // Cleanup temporary files after build
      const tempDir = join(rootDir, '.l5e-temp');
      if (existsSync(tempDir)) {
        try {
          rmSync(tempDir, { recursive: true, force: true });
          console.log('[l5e] Cleaned up temporary files');
        } catch (error) {
          console.warn('[l5e] Failed to cleanup temporary files:', error);
        }
      }
    },

    writeBundle(_options, _bundle) {
      // Emit action registry JSON for production server
      if (actionRegistry.size > 0) {
        const outDir = join(rootDir, 'dist', 'server');
        if (!existsSync(outDir)) {
          mkdirSync(outDir, { recursive: true });
        }
        const registryObj = Object.fromEntries(actionRegistry);
        writeFileSync(join(outDir, 'action-registry.json'), JSON.stringify(registryObj), 'utf-8');
        console.log(`[l5e] Wrote action-registry.json (${actionRegistry.size} actions)`);
      }
    },

    config(userConfig) {
      // Auto-discover rollup input from useCss and useClientJs
      const projectRoot = userConfig.root || process.cwd();
      const discovered = discoverRollupInput(projectRoot);

      // Store island registries for use in other hooks
      islandRegistry = discovered.islandRegistry;
      pathToKey = discovered.pathToKey;
      keyToSrc = discovered.keyToSrc;
      actionRegistry = discovered.actionRegistry;

      // Merge with existing rollupOptions.input if any
      const existingInput = userConfig.build?.rollupOptions?.input || {};
      const mergedInput =
        typeof existingInput === 'object' && !Array.isArray(existingInput)
          ? { ...discovered.input, ...existingInput }
          : discovered.input;

      return {
        build: {
          ...userConfig.build,
          rollupOptions: {
            ...userConfig.build?.rollupOptions,
            input: Object.keys(mergedInput).length > 0 ? mergedInput : undefined,
            // Preserve exports for island component entries â€” without this,
            // Rollup tree-shakes their exports since nothing in the bundle imports them
            // (they're loaded at runtime via dynamic import from the island runtime).
            preserveEntrySignatures: 'exports-only',
          },
        },
      } satisfies UserConfig;
    },

    resolveId(id) {
      if (id === VIRTUAL_L5E_VIEWS) {
        return '\0' + VIRTUAL_L5E_VIEWS;
      }
      if (id === VIRTUAL_L5E_ROUTE) {
        return '\0' + VIRTUAL_L5E_ROUTE;
      }
      if (id === VIRTUAL_L5E_SSR_ENTRY) {
        return '\0' + VIRTUAL_L5E_SSR_ENTRY;
      }
      if (id === VIRTUAL_L5E_GLOBAL_LOADER) {
        return '\0' + VIRTUAL_L5E_GLOBAL_LOADER;
      }
      if (id === VIRTUAL_L5E_ISLAND_STRATEGIES) {
        return '\0' + VIRTUAL_L5E_ISLAND_STRATEGIES;
      }
      if (id === VIRTUAL_L5E_ISLANDS) {
        return '\0' + VIRTUAL_L5E_ISLANDS;
      }
      if (id === VIRTUAL_L5E_ACTIONS) {
        return '\0' + VIRTUAL_L5E_ACTIONS;
      }
      if (id === VIRTUAL_L5E_MIDDLEWARE) {
        return '\0' + VIRTUAL_L5E_MIDDLEWARE;
      }
      return null;
    },

    async transform(code, id, options) {
      // Auto-inject island runtime into client.global.ts so it's always loaded globally
      if (id.replace(/\\/g, '/').endsWith('src/client.global.ts') && !options?.ssr) {
        return {
          code: `import '@withl5e/l5e/island/runtime';\n${code}`,
          map: null,
        };
      }

      // Client-side action transform: replace defineAction exports with fetch stubs
      // Supports actions anywhere under src/ (e.g., src/views/*, src/features/*, etc.)
      if (!options?.ssr) {
        const normalizedId = id.replace(/\\/g, '/');
        const actionMatch = normalizedId.match(/\/src\/(.+)\/actions\.(ts|tsx)$/);
        if (actionMatch) {
          const modulePath = actionMatch[1];

          // Parse exported action names
          const exportRegex = /export\s+const\s+(\w+)\s*=\s*defineAction\s*\(/g;
          const actions: Array<{ name: string; method: string }> = [];
          let m;
          while ((m = exportRegex.exec(code)) !== null) {
            const name = m[1];
            // Find method for this action â€” scan from the defineAction( position
            const chunk = code.substring(m.index, m.index + 500);
            const methodMatch = chunk.match(/method:\s*['"](\w+)['"]/);
            const method = methodMatch ? methodMatch[1].toUpperCase() : 'GET';
            actions.push({ name, method });
          }

          if (actions.length > 0) {
            const stubs = actions.map(({ name, method }) => {
              const actionKey = `${name}_${shortHash(modulePath)}`;
              if (method === 'GET') {
                return `export async function ${name}(params) {
  const res = await fetch('/_l5e/action/${actionKey}?' + new URLSearchParams(params));
  if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status), { status: res.status });
  return res;
}`;
              }
              return `export async function ${name}(body) {
  const res = await fetch('/_l5e/action/${actionKey}', {
    method: '${method}',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status), { status: res.status });
  return res;
}`;
            });

            return {
              code: stubs.join('\n\n'),
              map: null,
            };
          }
        }
      }

      // Skip node_modules
      if (id.includes('node_modules')) {
        return null;
      }

      // Skip files in /react/ directories
      if (id.includes('/react/') || id.includes('\\react\\')) {
        return null;
      }

      // Check if this is a JSX/TSX file that needs L5E JSX transformation
      const isJsxFile = /\.(tsx|jsx)$/.test(id);

      if (isJsxFile) {
        try {
          const injected = `import { Fragment as __Fragment, jsxFactory } from "@withl5e/l5e/jsx-runtime"\n${code}`;

          // Transform JSX using esbuild with L5E's JSX runtime (async)
          const result = await transform(injected, {
            loader: id.endsWith('.tsx') ? 'tsx' : 'jsx',
            jsx: 'transform',
            jsxFactory: 'jsxFactory',
            jsxFragment: '__Fragment',
            sourcemap: true,
            sourcefile: id,
            target: 'es2020',
          });

          let transformedCode = result.code;

          // Inject __key and __src for ALL ClientIsland calls
          if (transformedCode.includes('ClientIsland')) {
            transformedCode = injectIslandKeys(transformedCode, id, rootDir, pathToKey, keyToSrc);
          }

          return {
            code: transformedCode,
            map: result.map || null,
          };
        } catch (error) {
          // Log error but let Vite handle it
          console.error(`[l5e] Failed to transform JSX in ${id}:`, error);
          throw error;
        }
      }

      // Transform import.meta.env thÃ nh process.env á»Ÿ server side
      // Server side cÃ³ thá»ƒ access táº¥t cáº£ env variables
      // Client side chá»‰ access Ä‘Æ°á»£c VITE_ env variables
      // Transform nÃ y cháº¡y á»Ÿ runtime khi module Ä‘Æ°á»£c load trong SSR context
      if (options?.ssr) {
        let transformedCode = code;
        let hasChanges = false;

        // Thay tháº¿ import.meta.env.VARIABLE_NAME thÃ nh process.env.VARIABLE_NAME
        // Match: import.meta.env.VITE_EVENT_CATEGORY_SLUG
        transformedCode = transformedCode.replace(
          /import\.meta\.env\.([a-zA-Z_][a-zA-Z0-9_]*)/g,
          (match, varName) => {
            // Leave Vite's built-in env vars for Vite to handle.
            if (VITE_RESERVED_ENV.has(varName)) return match;
            hasChanges = true;
            return `process.env.${varName}`;
          },
        );

        // Thay tháº¿ import.meta.env['VARIABLE_NAME'] hoáº·c import.meta.env["VARIABLE_NAME"]
        // thÃ nh process.env['VARIABLE_NAME'] hoáº·c process.env["VARIABLE_NAME"]
        // Match: import.meta.env['VITE_EVENT_CATEGORY_SLUG'] hoáº·c import.meta.env["VITE_EVENT_CATEGORY_SLUG"]
        transformedCode = transformedCode.replace(
          /import\.meta\.env\[(['"`])([^'"`]+)\1\]/g,
          (match, quote, varName) => {
            // Leave Vite's built-in env vars for Vite to handle.
            if (VITE_RESERVED_ENV.has(varName)) return match;
            hasChanges = true;
            return `process.env[${quote}${varName}${quote}]`;
          },
        );

        if (hasChanges) {
          return {
            code: transformedCode,
            map: null, // KhÃ´ng cáº§n source map cho env transform
          };
        }
      }
      return null;
    },

    load(id) {
      // Virtual module: l5e-views
      if (id === '\0' + VIRTUAL_L5E_VIEWS) {
        return `
export const viewLoaders = import.meta.glob('/src/views/*/loader.{ts,tsx}');
export const viewComponents = import.meta.glob('/src/views/*/index.tsx');
`;
      }

      // Virtual module: l5e-route
      if (id === '\0' + VIRTUAL_L5E_ROUTE) {
        // Load /src/route.ts LAZILY (dynamic import inside the handler) rather
        // than via a static `export { default } from '/src/route.ts'`.
        //
        // A static re-export drags the user's route module — and everything it
        // imports — into entry-server's *static* SSR graph. Route files commonly
        // import the `@withl5e/l5e` barrel (for RedirectException, types, ...),
        // and that barrel re-exports `render` from entry-server. That closes a
        // static import cycle:
        //   entry-server → virtual:l5e-route → /src/route.ts → @withl5e/l5e → entry-server
        // On the first dev request Vite can begin evaluating entry-server while
        // it is still suspended awaiting this very import, so `render()` runs
        // before `const __vite_ssr_import_N__ = await import('virtual:l5e-route')`
        // has been assigned — throwing "Cannot access '__vite_ssr_import_N__'
        // before initialization". A page reload "fixes" it only because the graph
        // is fully warm the second time.
        //
        // Importing lazily removes /src/route.ts from the static graph: entry-server
        // finishes initializing first, and the route module (with its barrel import
        // back to a now-complete entry-server) is pulled only on the first render()
        // call. No manual caching — Vite/ESM caches the evaluated module and later
        // imports still observe HMR invalidations of route.ts.
        return `export default function routeHandler(requestInfo) {
  return import('/src/route.ts').then((mod) => mod.default(requestInfo));
}`;
      }

      // Virtual module: l5e-ssr-entry
      if (id === '\0' + VIRTUAL_L5E_SSR_ENTRY) {
        return `export { render } from '@withl5e/l5e/entry-server';
export { viewActions } from 'virtual:l5e-actions';`;
      }

      // Virtual module: l5e-global-loader
      if (id === '\0' + VIRTUAL_L5E_GLOBAL_LOADER) {
        return `export const globalLoader = import.meta.glob('/src/global-loader.{ts,tsx}', { eager: false });`;
      }

      // Virtual module: l5e-actions
      if (id === '\0' + VIRTUAL_L5E_ACTIONS) {
        const registryObj = Object.fromEntries(actionRegistry);
        return `export const viewActions = import.meta.glob('/src/**/actions.{ts,tsx}');
export const actionRegistry = ${JSON.stringify(registryObj)};`;
      }

      // Virtual module: l5e-middleware
      if (id === '\0' + VIRTUAL_L5E_MIDDLEWARE) {
        return `
const middlewareModules = import.meta.glob([
  '/src/middleware.{ts,tsx,js,jsx}',
  '/src/middleware/index.{ts,tsx,js,jsx}',
]);

const middlewarePaths = [
  '/src/middleware.ts',
  '/src/middleware.tsx',
  '/src/middleware.js',
  '/src/middleware.jsx',
  '/src/middleware/index.ts',
  '/src/middleware/index.tsx',
  '/src/middleware/index.js',
  '/src/middleware/index.jsx',
];

export async function loadMiddleware() {
  const middlewarePath = middlewarePaths.find((path) => middlewareModules[path]);
  if (!middlewarePath) return undefined;

  const mod = await middlewareModules[middlewarePath]();
  return mod.onRequest;
}
`;
      }

      // Virtual module: l5e-islands
      // Lazy glob of all React island components so the SSR entry can import a
      // component by its __src path and renderToString() it. Non-eager → only
      // islands actually present on a page (with ssr) get imported at runtime.
      if (id === '\0' + VIRTUAL_L5E_ISLANDS) {
        return `export const islandModules = import.meta.glob('/src/**/react/*.{tsx,jsx}');`;
      }

      // Virtual module: l5e-island-strategies
      if (id === '\0' + VIRTUAL_L5E_ISLAND_STRATEGIES) {
        // Check if src/island-strategies.ts exists
        const strategiesFile = join(rootDir, 'src', 'island-strategies.ts');
        if (existsSync(strategiesFile)) {
          // Re-export user's file â†’ Vite will build this file
          return `import '/src/island-strategies.ts';`;
        }
        // No file â†’ empty module, no error
        return `/* no custom island strategies */`;
      }

      return null;
    },
  };
}

export default coreVite;
