import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const GLOBAL_STYLE_SOURCE = '/src/global.css';
export const GLOBAL_STYLE_MANIFEST_KEY = 'src/global.css';

export function findGlobalStyleInput(root: string): string | null {
  const absolutePath = join(root, GLOBAL_STYLE_MANIFEST_KEY);
  return existsSync(absolutePath) ? absolutePath : null;
}

export function withAssetBase(base: string, assetPath: string): string {
  const cleanPath = assetPath.replace(/^\/+/, '');
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${cleanPath}`;
}

export function resolveGlobalStyleHref({
  root,
  manifest,
  isProduction,
  base,
}: {
  root: string;
  manifest?: Record<string, any>;
  isProduction: boolean;
  base: string;
}): string | null {
  if (!isProduction) {
    return findGlobalStyleInput(root) ? withAssetBase(base, GLOBAL_STYLE_SOURCE) : null;
  }

  const file = manifest?.[GLOBAL_STYLE_MANIFEST_KEY]?.file;
  return typeof file === 'string' ? withAssetBase(base, file) : null;
}
