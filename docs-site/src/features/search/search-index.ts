import MiniSearch from 'minisearch';
import fs from 'node:fs/promises';
import path from 'node:path';

interface DocRecord {
  id: string;
  slug: string;
  title: string;
  section: string;
  body: string;
  order: number;
}

let cached: MiniSearch<DocRecord> | null = null;
let buildPromise: Promise<MiniSearch<DocRecord>> | null = null;

export function getSearchIndex(): Promise<MiniSearch<DocRecord>> {
  if (cached) return Promise.resolve(cached);
  if (buildPromise) return buildPromise;
  buildPromise = buildIndex().then((index) => {
    cached = index;
    buildPromise = null;
    return index;
  });
  return buildPromise;
}

async function buildIndex(): Promise<MiniSearch<DocRecord>> {
  const records = await loadAllDocs();

  const index = new MiniSearch<DocRecord>({
    fields: ['title', 'body', 'section'],
    // We store the full body (plain text) so runSearch can build a contextual
    // snippet around the matched term per hit. Bodies are small (1–3 KB each
    // after stripping markdown), so the in-memory footprint stays trivial.
    storeFields: ['slug', 'title', 'section', 'body'],
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      boost: { title: 3, section: 1.5 },
    },
  });

  index.addAll(records);
  return index;
}

async function loadAllDocs(): Promise<DocRecord[]> {
  const contentDir = path.resolve(process.cwd(), 'content');
  const fileNames = await fs.readdir(contentDir);
  const markdownFiles = fileNames.filter((fileName) => fileName.endsWith('.md'));

  return Promise.all(
    markdownFiles.map(async (fileName) => {
      const filePath = path.join(contentDir, fileName);
      const markdown = await fs.readFile(filePath, 'utf-8');
      const { frontmatter, body } = parseFrontmatter(markdown);
      const slug = getSlugFromFileName(fileName);
      const title = frontmatter.title || getMarkdownTitle(body) || slug;
      const section = frontmatter.section || 'Docs';
      const plainBody = stripMarkdown(body);

      return {
        id: slug,
        slug,
        title,
        section,
        body: plainBody,
        order: frontmatter.order ?? Number.MAX_SAFE_INTEGER,
      };
    }),
  );
}

interface Frontmatter {
  title?: string;
  description?: string;
  section?: string;
  order?: number;
}

function parseFrontmatter(markdown: string): { frontmatter: Frontmatter; body: string } {
  if (!markdown.startsWith('---')) return { frontmatter: {}, body: markdown };
  const endIndex = markdown.indexOf('\n---', 3);
  if (endIndex === -1) return { frontmatter: {}, body: markdown };

  const rawFrontmatter = markdown.slice(3, endIndex).trim();
  const body = markdown.slice(endIndex + '\n---'.length).trimStart();
  const frontmatter: Frontmatter = {};

  for (const line of rawFrontmatter.split('\n')) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, '');
    if (key === 'order') frontmatter.order = Number(value);
    else if (key === 'title' || key === 'description' || key === 'section') {
      frontmatter[key] = value;
    }
  }
  return { frontmatter, body };
}

function getSlugFromFileName(fileName: string): string {
  return fileName.replace(/^\d+-/, '').replace(/\.md$/, '');
}

function getMarkdownTitle(markdown: string): string | null {
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  return titleMatch?.[1]?.trim() || null;
}

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, (m) => m.slice(1, -1))
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeSnippet(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}
