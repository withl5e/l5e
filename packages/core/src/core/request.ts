import type { Request } from 'express';

export function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};

  return cookieHeader.split(';').reduce(
    (cookies, cookie) => {
      const [name, ...rest] = cookie.split('=');
      if (name && rest.length > 0) {
        cookies[name.trim()] = decodeURIComponent(rest.join('=').trim());
      }
      return cookies;
    },
    {} as Record<string, string>,
  );
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
