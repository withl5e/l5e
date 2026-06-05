import { describe, expect, it } from 'vitest';
import { coreVite } from '../src/core/vite-plugin';

/**
 * The plugin rewrites `import.meta.env.*` to `process.env.*` for SSR so server
 * code can read non-VITE_ env vars. It must NOT touch Vite's built-in env vars
 * (MODE/DEV/PROD/SSR/BASE_URL) — those are statically provided by Vite.
 *
 * NOTE: the plugin's rewrite is a plain regex (not AST-aware), so it also
 * rewrites the literal `import.meta.env.X` inside THIS test file when Vitest
 * transforms it. We therefore build those tokens via concatenation so the
 * fixtures survive to runtime intact.
 */
const META_ENV = 'import.meta' + '.env';
const dot = (k: string) => `${META_ENV}.${k}`;
const bracket = (k: string) => `${META_ENV}['${k}']`;

async function transform(
  code: string,
  { id = '/src/app/config.ts', ssr = true }: { id?: string; ssr?: boolean } = {},
): Promise<string | null> {
  const plugin = coreVite();
  const hook = (plugin as any).transform;
  const handler = typeof hook === 'function' ? hook : hook.handler;
  const result = await handler.call({}, code, id, { ssr });
  return result ? result.code : null;
}

describe('vite-plugin import.meta.env rewrite (SSR)', () => {
  it('rewrites custom env vars to process.env', async () => {
    const out = await transform(`const a = ${dot('MY_SECRET')};`);
    expect(out).toContain('process.env.MY_SECRET');
    expect(out).not.toContain(dot('MY_SECRET'));
  });

  it('rewrites VITE_-prefixed custom vars too', async () => {
    const out = await transform(`const a = ${dot('VITE_API_URL')};`);
    expect(out).toContain('process.env.VITE_API_URL');
  });

  it('does NOT clobber Vite built-in env vars', async () => {
    const code = [
      `const dev = ${dot('DEV')};`,
      `const prod = ${dot('PROD')};`,
      `const mode = ${dot('MODE')};`,
      `const ssr = ${dot('SSR')};`,
      `const base = ${dot('BASE_URL')};`,
    ].join('\n');
    // Only reserved vars present → nothing rewritten → transform returns null
    // (code left untouched for Vite to handle).
    expect(await transform(code)).toBeNull();
  });

  it('preserves built-ins while still rewriting custom vars (mixed)', async () => {
    const out = await transform(`const d = ${dot('DEV')}; const s = ${dot('MY_SECRET')};`);
    expect(out).toContain(dot('DEV')); // untouched
    expect(out).toContain('process.env.MY_SECRET'); // rewritten
    expect(out).not.toContain('process.env.DEV');
  });

  it('handles bracket access: skips built-ins, rewrites custom keys', async () => {
    const out = await transform(`const m = ${bracket('MODE')}; const k = ${bracket('MY_KEY')};`);
    expect(out).toContain(bracket('MODE')); // untouched
    expect(out).toContain("process.env['MY_KEY']"); // rewritten
  });

  it('does not rewrite anything on the client (non-SSR)', async () => {
    const out = await transform(`const a = ${dot('MY_SECRET')};`, { ssr: false });
    // Client transform leaves import.meta.env to Vite entirely.
    expect(out).toBeNull();
  });
});
