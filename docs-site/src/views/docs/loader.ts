import { NotFoundException } from '@withl5e/l5e';
import type {
  GenerateMetadataFunction,
  LoaderFunction,
} from '@withl5e/l5e/entry-server';
import { Marked } from 'marked';
import fs from 'node:fs/promises';
import path from 'node:path';

import { highlightCode } from '~/features/syntax-highlight/highlighter';

// Marked v14: the renderer hook is sync, but `walkTokens` runs async and lets
// us mutate the token's text/escaped flags before rendering. We do the Shiki
// pass there, store the full <pre>...</pre> HTML on the token, and have the
// renderer return that text as-is.
const md = new Marked({
  async: true,
  gfm: true,
  walkTokens: async (token: any) => {
    if (token.type === 'code') {
      token.text = await highlightCode(token.text, token.lang);
      token.escaped = true;
    }
  },
  renderer: {
    code({ text }: any) {
      return text;
    },
  } as any,
});

interface Frontmatter {
  title?: string;
  description?: string;
  section?: string;
  order?: number;
}

export interface DocsNavItem {
  title: string;
  href: string;
  slug: string;
  section: string;
}

export interface DocsNavGroup {
  section: string;
  items: DocsNavItem[];
}

export interface DocsPageProps {
  title: string;
  description: string;
  html: string;
  sourcePath: string;
  currentSlug: string;
  navGroups: DocsNavGroup[];
  previous?: DocsNavItem;
  next?: DocsNavItem;
}

interface DocEntry extends DocsNavItem {
  description: string;
  order: number;
  filePath: string;
  sourcePath: string;
}

const SITE_TITLE = 'L5E';

export const loader: LoaderFunction = async (requestInfo) => {
  const docs = await loadDocs();
  if (docs.length === 0) {
    throw new NotFoundException('No documentation pages found in /content');
  }
  const currentSlug = getSlugFromPathname(requestInfo.pathname, docs[0].slug);
  const currentIndex = docs.findIndex((doc) => doc.slug === currentSlug);

  if (currentIndex === -1) {
    throw new NotFoundException(`Documentation page not found: ${currentSlug}`);
  }

  const currentDoc = docs[currentIndex];
  const markdown = await fs.readFile(currentDoc.filePath, 'utf-8');
  const { body } = parseFrontmatter(markdown);
  const html = await md.parse(body);

  return {
    props: {
      title: currentDoc.title,
      description: currentDoc.description,
      html,
      sourcePath: currentDoc.sourcePath,
      currentSlug: currentDoc.slug,
      navGroups: groupDocs(docs),
      previous: docs[currentIndex - 1],
      next: docs[currentIndex + 1],
    } satisfies DocsPageProps,
    maxAge: 0,
    sMaxAge: 60,
    swr: 300,
    cacheTags: ['docs', `docs:${currentDoc.slug}`],
  };
};

export const generateMetadata: GenerateMetadataFunction = (_requestInfo, props) => ({
  title: `${(props as DocsPageProps).title} — ${SITE_TITLE}`,
  description: (props as DocsPageProps).description,
});

async function loadDocs(): Promise<DocEntry[]> {
  const contentDir = path.resolve(process.cwd(), 'content');
  const fileNames = await fs.readdir(contentDir);
  const markdownFiles = fileNames.filter((fileName) => fileName.endsWith('.md'));

  const docs = await Promise.all(
    markdownFiles.map(async (fileName) => {
      const filePath = path.join(contentDir, fileName);
      const markdown = await fs.readFile(filePath, 'utf-8');
      const { frontmatter, body } = parseFrontmatter(markdown);
      const slug = getSlugFromFileName(fileName);
      const title = frontmatter.title || getMarkdownTitle(body) || slug;
      const section = frontmatter.section || 'Docs';

      return {
        title,
        description: frontmatter.description || title,
        href: `/docs/${slug}`,
        slug,
        section,
        order: frontmatter.order ?? Number.MAX_SAFE_INTEGER,
        filePath,
        sourcePath: path.relative(process.cwd(), filePath).replaceAll(path.sep, '/'),
      } satisfies DocEntry;
    }),
  );

  return docs.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

function groupDocs(docs: DocEntry[]): DocsNavGroup[] {
  const groups: DocsNavGroup[] = [];

  for (const doc of docs) {
    let group = groups.find((item) => item.section === doc.section);
    if (!group) {
      group = { section: doc.section, items: [] };
      groups.push(group);
    }
    group.items.push({
      title: doc.title,
      href: doc.href,
      slug: doc.slug,
      section: doc.section,
    });
  }

  return groups;
}

function getSlugFromPathname(pathname: string | undefined, fallback: string): string {
  if (!pathname) return fallback;
  const normalized = pathname.replace(/\/+$/, '');
  if (normalized === '' || normalized === '/docs') return fallback;
  if (normalized.startsWith('/docs/')) {
    return decodeURIComponent(normalized.slice('/docs/'.length));
  }
  return decodeURIComponent(normalized.replace(/^\//, ''));
}

function getSlugFromFileName(fileName: string): string {
  return fileName.replace(/^\d+-/, '').replace(/\.md$/, '');
}

function parseFrontmatter(markdown: string): { frontmatter: Frontmatter; body: string } {
  if (!markdown.startsWith('---')) {
    return { frontmatter: {}, body: markdown };
  }

  const endIndex = markdown.indexOf('\n---', 3);
  if (endIndex === -1) {
    return { frontmatter: {}, body: markdown };
  }

  const rawFrontmatter = markdown.slice(3, endIndex).trim();
  const body = markdown.slice(endIndex + '\n---'.length).trimStart();
  const frontmatter: Frontmatter = {};

  for (const line of rawFrontmatter.split('\n')) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, '');

    if (key === 'order') {
      frontmatter.order = Number(value);
    } else if (key === 'title' || key === 'description' || key === 'section') {
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}

function getMarkdownTitle(markdown: string): string | null {
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  return titleMatch?.[1]?.trim() || null;
}
