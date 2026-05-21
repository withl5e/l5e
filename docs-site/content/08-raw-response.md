---
title: Raw Response
description: Bypass JSX when you need to emit non-HTML.
section: Routing & Navigation
order: 8
---

# Raw Response

- Loader returns `{ rawResponse: { body, statusCode, headers } }` to send bytes directly.
- Use cases: `sitemap.xml`, `robots.txt`, JSON feeds, file downloads.
- Skips component render entirely — fastest path through the framework.
