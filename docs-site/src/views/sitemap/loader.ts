import type { LoaderFunction, LoaderResult } from '@withl5e/l5e/entry-server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { EnumChangefreq, SitemapStream, streamToPromise, type SitemapItemLoose } from 'sitemap';

export const loader: LoaderFunction = async (requestInfo): Promise<LoaderResult> => {
  const hostname = getBaseUrl(requestInfo.url);
  const links = await collectLinks();

  // xslUrl makes the sitemap human-readable in a browser via the stylesheet
  // at /public/sitemap.xsl (crawlers ignore the PI and read the XML directly).
  const stream = new SitemapStream({
    hostname,
    xslUrl: `${hostname}/sitemap.xsl`,
  });
  const data = await streamToPromise(Readable.from(links).pipe(stream));

  // Framework's rawResponse path bypasses the HTML cache-header logic,
  // so set Cache-Control + Cache-Tag manually. `global` matches the tag
  // the release workflow purges via the Cloudflare API on every deploy.
  return {
    rawResponse: {
      body: data.toString(),
      contentType: 'application/xml; charset=utf-8',
      statusCode: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'Cache-Tag': 'global,sitemap',
      },
    },
  };
};

async function collectLinks(): Promise<SitemapItemLoose[]> {
  const contentDir = path.resolve(process.cwd(), 'content');
  const fileNames = await fs.readdir(contentDir);
  const markdownFiles = fileNames.filter((name) => name.endsWith('.md'));

  const docs = await Promise.all(
    markdownFiles.map(async (fileName) => {
      const filePath = path.join(contentDir, fileName);
      const [stat, markdown] = await Promise.all([
        fs.stat(filePath),
        fs.readFile(filePath, 'utf-8'),
      ]);
      const slug = fileName.replace(/^\d+-/, '').replace(/\.md$/, '');
      const order = getFrontmatterOrder(markdown);

      return {
        url: `/docs/${slug}`,
        lastmod: stat.mtime.toISOString(),
        changefreq: EnumChangefreq.WEEKLY,
        priority: 0.7,
        order,
      };
    }),
  );

  // Home first, then docs in their frontmatter `order` (matches the
  // sidebar), with path as a stable tiebreaker.
  const sortedDocs = docs
    .sort((a, b) => a.order - b.order || a.url.localeCompare(b.url))
    .map(({ order: _order, ...entry }) => entry satisfies SitemapItemLoose);

  return [
    {
      url: '/',
      lastmod: new Date().toISOString(),
      changefreq: EnumChangefreq.WEEKLY,
      priority: 1.0,
    },
    ...sortedDocs,
  ];
}

function getBaseUrl(url?: URL): string {
  // Server-side file: use process.env, not import.meta.env. Vite only
  // statically replaces `import.meta.env.DEV` in client builds, so in SSR
  // the property access returns undefined even though the env proxy lists
  // it. process.env.NODE_ENV is the reliable signal here.
  const fromEnv = process.env.PUBLIC_URL || process.env.VITE_PUBLIC_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  if (process.env.NODE_ENV !== 'production' && url?.origin) return url.origin;
  return 'https://l5e.dev';
}

function getFrontmatterOrder(markdown: string): number {
  const match = markdown.match(/^order:\s*(\d+)/m);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}
