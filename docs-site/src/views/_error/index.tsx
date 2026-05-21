import { Fragment, Head, useCss } from '@withl5e/l5e/jsx-runtime';

import { MainMenu } from '~/shared/main-menu/MainMenu';

export interface ErrorPageProps {
  statusCode: number;
  message: string;
  data?: Record<string, unknown>;
}

const FIRST_DOC_HREF = '/docs/why-l5e';

function titleFor(code: number): string {
  if (code === 404) return 'Page not found';
  if (code === 410) return 'Page gone';
  if (code === 503) return 'Service unavailable';
  if (code >= 500) return 'Something went wrong';
  if (code >= 400) return 'Bad request';
  return 'Error';
}

function hintFor(code: number): string {
  if (code === 404)
    return "The page you're looking for doesn't exist or has been moved.";
  if (code === 410) return 'This page has been permanently removed.';
  if (code === 503)
    return 'The service is temporarily unavailable. Try again in a moment.';
  if (code >= 500) return 'An unexpected error occurred on our side.';
  if (code >= 400) return 'The request could not be processed.';
  return 'An unexpected error occurred.';
}

export default function ErrorPage({ statusCode, message, data }: ErrorPageProps) {
  useCss('/src/views/_error/styles.css');

  const title = titleFor(statusCode);
  const hint = hintFor(statusCode);
  const isProd = process.env.NODE_ENV === 'production';

  return (
    <Fragment>
      <Head>
        <title>{statusCode} · {title} — L5E</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <MainMenu />

      <main class="error-page">
        <div class="error-page__inner">
          <p class="error-page__code">{statusCode}</p>
          <h1 class="error-page__title">{title}</h1>
          <p class="error-page__message">{message}</p>
          <p class="error-page__hint">{hint}</p>

          <div class="error-page__actions">
            <a class="error-page__btn error-page__btn--primary" href="/">
              Back to home
            </a>
            <a class="error-page__btn error-page__btn--ghost" href={FIRST_DOC_HREF}>
              Open the docs
            </a>
          </div>

          {!isProd && data && Object.keys(data).length > 0 ? (
            <details class="error-page__data">
              <summary>Debug data (development only)</summary>
              <pre>
                <code>{JSON.stringify(data, null, 2)}</code>
              </pre>
            </details>
          ) : null}
        </div>
      </main>
    </Fragment>
  );
}
