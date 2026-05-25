import type { RouteAst } from './parser';

export function splitPath(pathname: string): string[] {
  if (!pathname || pathname === '/') return [];
  const trimmed = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  const withoutTrailing = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  if (withoutTrailing.length === 0) return [];
  return withoutTrailing.split('/');
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function match(
  ast: RouteAst,
  urlSegments: string[],
): Record<string, string> | null {
  const { segments, hasSplat } = ast;

  if (hasSplat) {
    // Splat routes require: all leading segments match, plus at least one extra segment
    // for the splat itself (splat does not match an empty tail).
    const leading = segments.length - 1;
    if (urlSegments.length <= leading) return null;
    const params: Record<string, string> = {};
    for (let i = 0; i < leading; i++) {
      const seg = segments[i];
      const urlSeg = urlSegments[i];
      if (seg.kind === 'static') {
        if (seg.value !== urlSeg) return null;
      } else if (seg.kind === 'param') {
        params[seg.name] = safeDecode(urlSeg);
      }
      // splat shouldn't appear before the last segment — parser guards this.
    }
    const tail = urlSegments.slice(leading).map(safeDecode).join('/');
    params._splat = tail;
    return params;
  }

  if (segments.length !== urlSegments.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const urlSeg = urlSegments[i];
    if (seg.kind === 'static') {
      if (seg.value !== urlSeg) return null;
    } else if (seg.kind === 'param') {
      params[seg.name] = safeDecode(urlSeg);
    }
  }
  return params;
}
