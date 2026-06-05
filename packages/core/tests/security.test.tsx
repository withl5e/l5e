import serialize from 'serialize-javascript';
import { describe, expect, it } from 'vitest';
import { jsxFactory as jsxFactoryAlias } from '../src/core/jsx-runtime';
import { renderJsxToHtmlString } from '../src/core/render';
import { applyHtmlLang } from '../src/core/server';
import { parseCookies } from '../src/core/request';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const jsxFactory = jsxFactoryAlias;

/**
 * Security regressions for the fixes in this branch:
 *  - JSON serialized into <script> must not allow </script> breakout
 *  - <html lang="…"> must escape loader-supplied values
 *  - cookie parsing must not throw / must ignore prototype keys
 */
describe('serialize-javascript guards <script> injection', () => {
  const BREAKOUT = '</script><script>alert(1)</script>';

  it('escapes </script> for JSON-LD (isJSON) and keeps valid JSON', () => {
    const out = serialize({ headline: BREAKOUT }, { isJSON: true });
    expect(out).not.toContain('</script>');
    expect(out).toContain('\\u003C'); // "<" encoded
    // still parseable as JSON once unescaped by the HTML/JS parser
    expect(JSON.parse(out).headline).toBe(BREAKOUT);
  });

  it('escapes </script> for the island registry inline script', () => {
    const out = serialize({ 'Evil</script>': '/assets/x.js' });
    expect(out).not.toContain('</script>');
    expect(out).toContain('\\u003C');
  });

  it('produces a JSON-LD <script> body that cannot break out', () => {
    // Mirrors exactly what entry-server.ts emits for schemas.
    const schemaJson = serialize(
      { '@type': 'Article', headline: BREAKOUT },
      { isJSON: true },
    );
    const html = renderJsxToHtmlString(
      <script type="application/ld+json" setHtml={schemaJson} />,
    );

    // The only literal </script> in the output is the element's own closing tag.
    const closings = html.split('</script>').length - 1;
    expect(closings).toBe(1);
    expect(html).not.toContain('<script>alert(1)');
  });
});

describe('applyHtmlLang escapes the lang attribute', () => {
  const template = '<!doctype html><html><head></head><body></body></html>';

  it('keeps a normal lang value intact', () => {
    expect(applyHtmlLang(template, 'vi')).toContain('<html lang="vi">');
  });

  it('neutralises an attribute/tag breakout payload', () => {
    const out = applyHtmlLang(template, '"><script>alert(1)</script>');
    expect(out).not.toContain('<script>alert(1)</script>');
    expect(out).not.toContain('"><script>');
    expect(out).toContain('&quot;');
  });

  it('escapes an existing lang value too', () => {
    const withLang = '<html lang="en"><head></head></html>';
    const out = applyHtmlLang(withLang, '"><img src=x onerror=alert(1)>');
    expect(out).not.toContain('<img src=x');
    expect(out).toContain('&quot;');
  });
});

describe('parseCookies', () => {
  it('parses simple cookies', () => {
    expect(parseCookies('a=1; b=2')).toEqual({ a: '1', b: '2' });
  });

  it('does not throw on malformed percent-encoding', () => {
    expect(() => parseCookies('x=%E0%A4%A')).not.toThrow();
    expect(() => parseCookies('y=%')).not.toThrow();
  });

  it('ignores prototype-polluting keys', () => {
    const cookies = parseCookies('__proto__=polluted; safe=1');
    expect(cookies.safe).toBe('1');
    // base Object prototype is untouched
    expect(({} as any).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(cookies)).toBe(Object.prototype);
  });

  it('returns an empty object for an empty header', () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies('')).toEqual({});
  });
});
