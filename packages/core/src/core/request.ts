import { parse as parseCookieHeader } from 'cookie';
import type { Request } from 'express';

export function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};

  // `cookie.parse` decodes values safely (malformed %-sequences fall back to the
  // raw value instead of throwing) and ignores prototype keys.
  const parsed = parseCookieHeader(cookieHeader);
  const cookies: Record<string, string> = {};
  for (const [name, value] of Object.entries(parsed)) {
    if (value !== undefined) {
      cookies[name] = value;
    }
  }
  return cookies;
}

export function createHeadersFromExpressRequest(req: Request): Headers {
  const headers = new Headers();

  Object.entries(req.headers).forEach(([key, value]) => {
    if (value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(key, item));
      return;
    }
    headers.set(key, value);
  });

  return headers;
}
