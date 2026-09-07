import { describe, expect, it } from 'vitest';
import { coreVite } from '../src/core/vite-plugin';
import { createChunkPlanner } from '../src/core/chunking';

describe('client chunk configuration', () => {
  it('rejects ambiguous names and invalid split targets before starting a build', () => {
    expect(() =>
      coreVite({
        chunking: {
          shared: [
            { name: 'state', modules: ['./session.ts'] },
            { name: 'state', packages: ['some-store'] },
          ],
        },
      }),
    ).toThrow('duplicate');
    expect(() =>
      coreVite({ chunking: { shared: [{ name: '../state', packages: ['some-store'] }] } }),
    ).toThrow('Invalid');
    expect(() => coreVite({ chunking: { shared: [{ name: 'state' }] } })).toThrow(
      'needs packages or modules',
    );
    expect(() =>
      coreVite({ chunking: { shared: [{ name: 'state', packages: ['some-store'], maxSize: 0 }] } }),
    ).toThrow('maxSize');
    expect(() =>
      coreVite({
        chunking: {
          mode: 'compact',
          shared: [{ name: 'state', packages: ['some-store'], maxSize: 100_000 }],
        },
      }),
    ).toThrow('cannot use maxSize');
    expect(() => coreVite({ chunking: { mode: 'compact', islandRuntime: {} } })).toThrow(
      'islandRuntime needs packages or modules',
    );
  });

  it('requires an explicit choice between framework and raw bundler grouping', () => {
    const plugin = coreVite();
    const hook = plugin.config as Function;
    expect(() =>
      hook({ build: { rolldownOptions: { output: { manualChunks: () => 'vendor' } } } }),
    ).toThrow('chunking: false');
    expect(() =>
      hook({ build: { rolldownOptions: { output: { codeSplitting: false } } } }),
    ).toThrow('chunking: false');
  });

  it('rejects a module shared from a dynamic-only global branch', () => {
    const planner = createChunkPlanner({ mode: 'compact' });
    const module = (id: string, values: Record<string, unknown>) => ({
      id,
      isEntry: false,
      importedIds: [],
      dynamicallyImportedIds: [],
      importers: [],
      dynamicImporters: [],
      ...values,
    });
    expect(() =>
      planner.analyze([
        module('/app/src/client.global.ts', {
          isEntry: true,
          dynamicallyImportedIds: ['/app/src/session.ts'],
        }),
        module('/app/src/page.ts', {
          isEntry: true,
          importedIds: ['/app/src/session.ts'],
        }),
        module('/app/src/session.ts', {
          importers: ['/app/src/page.ts'],
          dynamicImporters: ['/app/src/client.global.ts'],
        }),
      ] as any),
    ).toThrow('dynamic-only global overlap');
  });
});
