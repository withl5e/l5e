<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0"
                xmlns:html="http://www.w3.org/1999/xhtml"
                xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml" lang="en">
      <head>
        <title>L5E — XML Sitemap</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <style type="text/css">
          :root {
            color-scheme: light dark;
            --bg: #ffffff;
            --bg-muted: #f6f7f9;
            --fg: #1f2328;
            --fg-muted: #57606a;
            --border: #d0d7de;
            --accent: #0969da;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --bg: #0d1117;
              --bg-muted: #161b22;
              --fg: #e6edf3;
              --fg-muted: #8b949e;
              --border: #30363d;
              --accent: #58a6ff;
            }
          }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
            color: var(--fg);
            background: var(--bg);
            max-width: 960px;
            margin: 0 auto;
            padding: 40px 20px;
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
          }
          h1 {
            font-size: 24px;
            margin: 0 0 4px 0;
            font-weight: 700;
          }
          .lead {
            color: var(--fg-muted);
            margin: 0 0 24px 0;
            font-size: 14px;
          }
          .meta {
            display: flex;
            gap: 24px;
            padding: 12px 16px;
            margin: 0 0 20px 0;
            background: var(--bg-muted);
            border: 1px solid var(--border);
            border-radius: 8px;
            font-size: 13px;
            color: var(--fg-muted);
          }
          .meta strong {
            color: var(--fg);
            font-weight: 600;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 8px;
            overflow: hidden;
            font-size: 14px;
          }
          thead {
            background: var(--bg-muted);
            border-bottom: 1px solid var(--border);
          }
          th {
            text-align: left;
            padding: 10px 14px;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--fg-muted);
          }
          td {
            padding: 10px 14px;
            border-bottom: 1px solid var(--border);
            vertical-align: middle;
          }
          tr:last-child td { border-bottom: none; }
          tr:hover td { background: var(--bg-muted); }
          a {
            color: var(--accent);
            text-decoration: none;
          }
          a:hover { text-decoration: underline; }
          .url {
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            font-size: 13px;
            word-break: break-all;
          }
          .priority { text-align: right; font-variant-numeric: tabular-nums; }
          .changefreq { color: var(--fg-muted); font-size: 13px; }
          .lastmod { color: var(--fg-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
          footer {
            margin-top: 24px;
            text-align: center;
            color: var(--fg-muted);
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <h1>XML Sitemap</h1>
        <p class="lead">URLs published on this site, exposed for search engine crawlers.</p>
        <div class="meta">
          <span><strong>URLs:</strong>&#160;<xsl:value-of select="count(sitemap:urlset/sitemap:url)"/></span>
          <span><strong>Generated:</strong>&#160;<xsl:value-of select="substring(sitemap:urlset/sitemap:url[1]/sitemap:lastmod, 0, 11)"/></span>
        </div>
        <table>
          <thead>
            <tr>
              <th>URL</th>
              <th class="priority">Priority</th>
              <th>Changefreq</th>
              <th>Last modified</th>
            </tr>
          </thead>
          <tbody>
            <xsl:for-each select="sitemap:urlset/sitemap:url">
              <xsl:sort select="sitemap:priority" order="descending"/>
              <tr>
                <td class="url">
                  <a>
                    <xsl:attribute name="href"><xsl:value-of select="sitemap:loc"/></xsl:attribute>
                    <xsl:value-of select="sitemap:loc"/>
                  </a>
                </td>
                <td class="priority"><xsl:value-of select="sitemap:priority"/></td>
                <td class="changefreq"><xsl:value-of select="sitemap:changefreq"/></td>
                <td class="lastmod">
                  <xsl:value-of select="substring(sitemap:lastmod, 0, 11)"/>
                </td>
              </tr>
            </xsl:for-each>
          </tbody>
        </table>
        <footer>
          Generated by <a href="https://l5e.dev">L5E</a> · <a href="/">Back to home</a>
        </footer>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
