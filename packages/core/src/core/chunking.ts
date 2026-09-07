import { createHash } from 'node:crypto';
import path from 'node:path';
import type { CodeSplittingGroup, ModuleInfo, OutputBundle } from 'rolldown';

export interface SharedChunkGroup {
  name: string;
  /** Exact package names, including their subpath imports. */
  packages?: string[];
  /** Module specifiers resolved by Vite, including aliases. */
  modules?: string[];
  priority?: number;
  /** Approximate uncompressed maximum; not a hard network byte budget. */
  maxSize?: number;
}

export interface ChunkingOptions {
  /**
   * Opt in to at most one global, one page bundle and one canonical shared file.
   * State that must retain identity across page bundles must be listed in `shared`.
   */
  mode?: 'compact';
  shared?: SharedChunkGroup[];
  /** Static UI/runtime roots that join React's canonical lazy activation chunk. */
  islandRuntime?: Pick<SharedChunkGroup, 'packages' | 'modules'>;
}

export interface CoreViteOptions {
  /** false leaves chunk placement to Vite; runtime identity protection stays enabled. */
  chunking?: ChunkingOptions | false;
}

const normalize = (id: string) => id.replace(/\\/g, '/');
const digest = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 8);

/** The last node_modules segment also handles pnpm's nested package layout. */
function packageName(id: string): string | undefined {
  const suffix = normalize(id).split('/node_modules/').at(-1);
  if (suffix === normalize(id)) return undefined;
  const parts = suffix!.split('/');
  return parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

type Decision = { group: string | null; rule?: string; consumers: string[]; reason: string };

/** One build-time plan drives placement and the diagnostic report. Runtime reads Vite's manifest. */
export function createChunkPlanner(options: ChunkingOptions = {}) {
  const rules = options.shared || [];
  const islandRuntimeRule = options.islandRuntime;
  if (
    islandRuntimeRule &&
    !islandRuntimeRule.packages?.length &&
    !islandRuntimeRule.modules?.length
  ) {
    throw new Error('[l5e chunking] islandRuntime needs packages or modules.');
  }
  if (options.mode === 'compact' && rules.length > 1) {
    throw new Error('[l5e chunking] Compact mode accepts one canonical shared group.');
  }
  const names = new Set<string>();
  for (const rule of rules) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(rule.name) || names.has(rule.name)) {
      throw new Error(`[l5e chunking] Invalid or duplicate shared group: ${rule.name}`);
    }
    if (!rule.packages?.length && !rule.modules?.length) {
      throw new Error(`[l5e chunking] Group ${rule.name} needs packages or modules.`);
    }
    if (rule.maxSize !== undefined && (!Number.isFinite(rule.maxSize) || rule.maxSize <= 0)) {
      throw new Error(`[l5e chunking] Invalid maxSize for ${rule.name}`);
    }
    if (options.mode === 'compact' && rule.maxSize !== undefined) {
      throw new Error(
        `[l5e chunking] Compact mode cannot use maxSize for ${rule.name}; it would split the canonical shared file.`,
      );
    }
    names.add(rule.name);
  }
  let root = '';
  const resolvedRules = new Map<SharedChunkGroup, Set<string>>();
  let resolvedIslandRuntime = new Set<string>();
  const decisions = new Map<string, Decision>();
  const warnings = new Set<string>();
  const portable = (id: string) => {
    const pkg = packageName(id);
    if (pkg) return `npm:${normalize(id).split('/node_modules/').at(-1)}`;
    return normalize(path.relative(root, id));
  };

  return {
    async resolve(
      projectRoot: string,
      resolveId: (id: string, importer: string) => Promise<string | null>,
    ) {
      root = projectRoot;
      resolvedRules.clear();
      resolvedIslandRuntime = new Set();
      decisions.clear();
      warnings.clear();
      for (const rule of rules) {
        const ids = new Set<string>();
        for (const specifier of rule.modules || []) {
          const id = await resolveId(specifier, path.join(root, 'index.html'));
          if (!id) throw new Error(`[l5e chunking] Cannot resolve ${specifier} in ${rule.name}`);
          ids.add(id);
        }
        resolvedRules.set(rule, ids);
      }
      if (islandRuntimeRule) {
        for (const specifier of islandRuntimeRule.modules || []) {
          const id = await resolveId(specifier, path.join(root, 'index.html'));
          if (!id) throw new Error(`[l5e chunking] Cannot resolve ${specifier} in islandRuntime`);
          resolvedIslandRuntime.add(id);
        }
      }
    },
    analyze(modules: ModuleInfo[]) {
      decisions.clear();
      const graph = new Map(modules.map((mod) => [mod.id, mod]));
      if (options.mode === 'compact') {
        const reachability = new Map<string, Map<string, boolean>>();
        for (const entry of modules.filter((mod) => mod.isEntry)) {
          const visit = (id: string, lazy: boolean) => {
            const owners = reachability.get(id) || new Map<string, boolean>();
            const previous = owners.get(entry.id);
            if (previous === false || previous === lazy) return;
            owners.set(entry.id, lazy);
            reachability.set(id, owners);
            const module = graph.get(id);
            if (!module) return;
            module.importedIds.forEach((dependency) => visit(dependency, lazy));
            module.dynamicallyImportedIds.forEach((dependency) => visit(dependency, true));
          };
          visit(entry.id, false);
        }
        const globalEntry = modules.find(
          (mod) => mod.isEntry && normalize(mod.id).endsWith('/src/client.global.ts'),
        );
        if (globalEntry) {
          for (const [id, owners] of reachability) {
            if (
              !/\.css(?:\?|$)/.test(normalize(id)) &&
              owners.get(globalEntry.id) === true &&
              [...owners.keys()].some((owner) => owner !== globalEntry.id)
            ) {
              throw new Error(
                `[l5e chunking] Compact mode cannot bridge a dynamic-only global overlap: ${portable(id)}. Import it statically from global or place state behind an explicit shared root.`,
              );
            }
          }
        }
      }
      const roots = modules.filter((mod) => mod.isEntry || mod.dynamicImporters.length > 0);
      const consumers = new Map<string, Set<string>>();
      for (const entry of roots) {
        const visited = new Set<string>();
        const visit = (id: string) => {
          if (visited.has(id)) return;
          visited.add(id);
          const mod = graph.get(id);
          if (!mod) return;
          const users = consumers.get(id) || new Set<string>();
          users.add(entry.id);
          consumers.set(id, users);
          mod.importedIds.forEach(visit);
        };
        visit(entry.id);
      }
      const rank = (id: string) => {
        const mod = graph.get(id)!;
        if (!mod.isEntry) return 3;
        if (normalize(id).endsWith('/src/client.global.ts')) return 0;
        if (normalize(id).includes('virtual:l5e-compact-renderer')) return 2;
        if (/\/react\//.test(normalize(id)) && !packageName(id)) return 2;
        return 1;
      };
      const matched = new Set<SharedChunkGroup>();
      for (const mod of modules) {
        const users = [...(consumers.get(mod.id) || [])].sort();
        const labels = users.map(portable).sort();
        const matches = rules
          .filter(
            (rule) =>
              resolvedRules.get(rule)?.has(mod.id) ||
              rule.packages?.includes(packageName(mod.id) || ''),
          )
          .sort((a, b) => (b.priority || 0) - (a.priority || 0));
        matches.forEach((rule) => matched.add(rule));
        if (matches.length > 1)
          warnings.add(
            `${portable(mod.id)} matches ${matches.map((r) => r.name).join(', ')}; using ${matches[0].name}.`,
          );
        let group: string | null = null;
        let reason = 'Private dependency stays with its entry or dynamic import.';
        const pkg = packageName(mod.id);
        const islandRuntimeMatch =
          resolvedIslandRuntime.has(mod.id) ||
          islandRuntimeRule?.packages?.includes(pkg || '') === true;
        if (
          options.mode === 'compact' &&
          normalize(mod.id).includes('virtual:l5e-compact-renderer')
        ) {
          group = 'lazy-react-runtime';
          reason = 'Renderer joins the canonical React runtime activation.';
        } else if (
          options.mode === 'compact' &&
          !mod.isEntry &&
          (pkg === 'react' || pkg === 'react-dom' || pkg === 'scheduler') &&
          users.length > 0 &&
          users.every((id) => rank(id) >= 2)
        ) {
          group = 'lazy-react-runtime';
          reason = 'Canonical React runtime is fetched when the first island activates.';
        } else if (!mod.isEntry && users.length && matches.length) {
          // Explicit groups can combine consumers at the same activation tier.
          // Never promote island-only code into global/page, or dynamic-only code
          // into a static entry. Distinct dynamic roots remain separate as well.
          const tier = Math.min(...users.map(rank));
          const activation =
            tier === 3
              ? `lazy-${digest(JSON.stringify(labels))}`
              : ['global', 'page', 'island'][tier];
          group = options.mode === 'compact' ? 'shared' : `shared-${matches[0].name}-${activation}`;
          reason = `Configured group ${matches[0].name}; activation ${activation}.`;
        } else if (options.mode === 'compact' && !mod.isEntry && islandRuntimeMatch) {
          group = 'lazy-react-runtime';
          reason = 'Configured canonical island runtime is fetched with the first island consumer.';
        } else if (
          options.mode === 'compact' &&
          !mod.isEntry &&
          users.some((id) => rank(id) === 0) &&
          users.some((id) => rank(id) > 0)
        ) {
          group = 'global-owner';
          reason = 'Static global/page overlap is exported by the canonical global artifact.';
        } else if (options.mode !== 'compact' && !mod.isEntry && users.length > 1) {
          group = `shared-auto-${digest(JSON.stringify(labels))}`;
          reason = 'Shared by the same static consumers; preserves dynamic import roots.';
        }
        decisions.set(mod.id, { group, rule: matches[0]?.name, consumers: labels, reason });
      }
      for (const rule of rules) {
        if (!matched.has(rule))
          warnings.add(`Group ${rule.name} matched no modules in this client build.`);
      }
      return [...warnings];
    },
    groups(): CodeSplittingGroup[] {
      return [
        ...rules.map((rule) => ({
          name: (id: string) => {
            const decision = decisions.get(id);
            return decision?.rule === rule.name ? decision.group : null;
          },
          maxSize: rule.maxSize,
          includeDependenciesRecursively: options.mode === 'compact',
        })),
        {
          name: (id: string) =>
            decisions.get(id)?.group === 'lazy-react-runtime' ? 'lazy-react-runtime' : null,
          includeDependenciesRecursively: true,
        },
        {
          name: (id: string) => {
            const group = decisions.get(id)?.group;
            return group === 'lazy-react-runtime' ? null : group || null;
          },
          includeDependenciesRecursively: false,
        },
      ];
    },
    report(bundle: OutputBundle) {
      return {
        version: 2,
        mode: options.mode || 'default',
        warnings: [...warnings],
        chunks: Object.values(bundle).flatMap((chunk) => {
          if (chunk.type !== 'chunk') return [];
          const source = chunk.facadeModuleId ? portable(chunk.facadeModuleId) : null;
          const kind =
            source === 'src/client.global.ts'
              ? 'global'
              : source && /(?:^|\/)react\//.test(source)
                ? 'island'
                : chunk.isEntry || chunk.isDynamicEntry
                  ? 'page'
                  : 'shared';
          return [
            {
              file: chunk.fileName,
              kind,
              canonicalShared: options.mode === 'compact' && chunk.name === 'shared',
              canonicalGlobal: options.mode === 'compact' && chunk.name === 'global-owner',
              source,
              bytes: Buffer.byteLength(chunk.code),
              imports: chunk.imports,
              dynamicImports: chunk.dynamicImports,
              modules: Object.keys(chunk.modules).map((id) => ({
                id: portable(id),
                ...decisions.get(id),
              })),
            },
          ];
        }),
      };
    },
  };
}
