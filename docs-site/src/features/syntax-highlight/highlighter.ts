import { createHighlighter, type Highlighter } from 'shiki';

const THEME = 'github-dark';
const LANGS = [
  'ts',
  'tsx',
  'js',
  'jsx',
  'css',
  'html',
  'json',
  'bash',
  'sh',
  'md',
  'diff',
] as const;

const KNOWN_LANGS = new Set<string>(LANGS);

let cached: Highlighter | null = null;
let inflight: Promise<Highlighter> | null = null;

export function getHighlighter(): Promise<Highlighter> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = createHighlighter({
    themes: [THEME],
    langs: [...LANGS],
  }).then((hl) => {
    cached = hl;
    inflight = null;
    return hl;
  });
  return inflight;
}

const LANG_ALIASES: Record<string, string> = {
  typescript: 'ts',
  javascript: 'js',
  shell: 'bash',
  yml: 'json', // close enough fallback; actual yaml grammar can be added later
  markdown: 'md',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function highlightCode(
  code: string,
  rawLang: string | undefined,
): Promise<string> {
  const langKey = (rawLang || '').toLowerCase();
  const lang = LANG_ALIASES[langKey] ?? langKey;

  if (!lang || !KNOWN_LANGS.has(lang)) {
    const langAttr = rawLang ? ` data-lang="${escapeHtml(rawLang)}"` : '';
    return `<pre class="shiki shiki--plain"${langAttr}><code>${escapeHtml(code)}</code></pre>`;
  }

  const hl = await getHighlighter();
  return hl.codeToHtml(code, { lang, theme: THEME });
}
