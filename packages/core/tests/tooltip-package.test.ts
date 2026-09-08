import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { expect, it } from 'vitest';

it('ships the tooltip facade without eagerly bundling its rendering runtime', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  // Exercise the actual published library build: source-level dynamic imports
  // can disappear when a public barrel also re-exports the runtime statically.
  const result = await build({
    root,
    configFile: path.join(root, 'vite.config.ts'),
    logLevel: 'silent',
    build: { write: false },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((output) =>
    'output' in output ? output.output : [],
  );
  const chunks = outputs.filter((output) => output.type === 'chunk');
  const facade = chunks.find((chunk) => chunk.fileName === 'tooltip.js')!;
  expect(facade).toBeDefined();
  expect(facade.exports).toEqual(
    expect.arrayContaining([
      'initTooltips',
      'setupTooltipObserver',
      'configureTooltip',
      'showTooltip',
      'showTooltipMobile',
    ]),
  );
  const pending = [facade];
  const eager = new Set<typeof facade>();
  while (pending.length) {
    const chunk = pending.pop()!;
    if (eager.has(chunk)) continue;
    eager.add(chunk);
    for (const dependency of chunk.imports) {
      const imported = chunks.find((candidate) => candidate.fileName === dependency);
      if (imported) pending.push(imported);
    }
  }
  const runtime = chunks.find((chunk) =>
    chunk.moduleIds.some((id) => id.replaceAll('\\', '/').endsWith('/tooltip-runtime.ts')),
  )!;
  expect(runtime).toBeDefined();
  expect([...eager].map((chunk) => chunk.fileName)).not.toContain(runtime.fileName);
  expect([...eager].flatMap((chunk) => chunk.imports)).not.toContain('@floating-ui/dom');
  expect([...eager].flatMap((chunk) => chunk.dynamicImports)).toContain(runtime.fileName);
}, 30_000);
