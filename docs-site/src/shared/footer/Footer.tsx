const GITHUB_URL = 'https://github.com/withl5e/l5e';
const NPM_URL = 'https://www.npmjs.com/package/@withl5e/l5e';
const FIRST_DOC_HREF = '/docs/why-l5e';

const DOCS_LINKS: { href: string; label: string }[] = [
  { href: '/docs/why-l5e', label: 'Why L5E' },
  { href: '/docs/architecture', label: 'Architecture' },
  { href: '/docs/install', label: 'Install' },
  { href: '/docs/routing', label: 'Routing' },
  { href: '/docs/loader', label: 'Loader' },
];

const PROJECT_LINKS: { href: string; label: string; external?: boolean }[] = [
  { href: GITHUB_URL, label: 'GitHub', external: true },
  { href: `${GITHUB_URL}/issues`, label: 'Issues', external: true },
  { href: `${GITHUB_URL}/blob/main/LICENSE`, label: 'MIT License', external: true },
  { href: NPM_URL, label: 'npm', external: true },
];

const CONNECT_LINKS: { href: string; label: string; external?: boolean }[] = [
  { href: GITHUB_URL, label: 'GitHub', external: true },
  { href: `${GITHUB_URL}/discussions`, label: 'Discussions', external: true },
  { href: `${GITHUB_URL}/stargazers`, label: 'Stargazers', external: true },
];

export function Footer() {
  return (
    <footer class="site-footer">
      <div class="site-footer__inner">
        <div class="site-footer__grid">
          <div class="site-footer__brand">
            <a class="site-footer__brand-link" href="/" aria-label="L5E home">
              <span class="site-footer__logo" aria-hidden="true">
                ▲
              </span>
              <span class="site-footer__brand-text">L5E</span>
            </a>
            <p class="site-footer__tag">
              HTML-first SSR for block-builder MPAs. Render what you render; bundle that.
            </p>
            <p class="site-footer__meta">
              Open source · MIT · v0.1.1-alpha
            </p>
          </div>

          <div class="site-footer__col">
            <h5>Docs</h5>
            <ul class="site-footer__list">
              {DOCS_LINKS.map((link) => (
                <li>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
              <li>
                <a class="site-footer__more" href={FIRST_DOC_HREF}>
                  Browse all →
                </a>
              </li>
            </ul>
          </div>

          <div class="site-footer__col">
            <h5>Project</h5>
            <ul class="site-footer__list">
              {PROJECT_LINKS.map((link) => (
                <li>
                  <a href={link.href} {...(link.external ? { rel: 'noreferrer' } : {})}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div class="site-footer__col">
            <h5>Connect</h5>
            <ul class="site-footer__list">
              {CONNECT_LINKS.map((link) => (
                <li>
                  <a href={link.href} {...(link.external ? { rel: 'noreferrer' } : {})}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div class="site-footer__bottom">
          <span class="site-footer__copy">
            © {new Date().getFullYear()} L5E. Released under the MIT License.
          </span>
          <ul class="site-footer__bottom-links">
            <li>
              <a href={GITHUB_URL} rel="noreferrer">
                Source
              </a>
            </li>
            <li>
              <a href={`${GITHUB_URL}/blob/main/SECURITY.md`} rel="noreferrer">
                Security
              </a>
            </li>
            <li>
              <a href={`${GITHUB_URL}/blob/main/CONTRIBUTING.md`} rel="noreferrer">
                Contributing
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
