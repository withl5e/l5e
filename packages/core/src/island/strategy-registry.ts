import type { MountStrategy } from './types';

export const strategies = new Map<string, MountStrategy>();

export function registerMountStrategy(name: string, fn: MountStrategy) {
  if (strategies.has(name)) {
    console.warn(`[l5e-island] Strategy "${name}" already registered, overwriting.`);
  }
  strategies.set(name, fn);
}
