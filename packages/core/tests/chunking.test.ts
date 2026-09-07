import { describe, expect, it } from 'vitest';
import { coreVite } from '../src/core/vite-plugin';

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
});
