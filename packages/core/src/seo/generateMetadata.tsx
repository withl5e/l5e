/// <reference types="../core/jsx-types" />
import { HEAD_PRIORITY } from '../core/head-priority';
import { Fragment, Head, resolveMetadata, useRequest } from '../core/jsx-runtime';

import { mergeMetadata } from './mergeMetadata';
import type { Metadata } from './types';

/**
 * Converts Metadata object to SEO meta tags
 * This is the core function that transforms the metadata object into actual HTML tags
 *
 * If metadata is provided, it will be merged with metadata from the stack (from global/page loaders)
 * If no metadata is provided, it will use resolved metadata from the stack
 */
export function MetadataRenderer({ metadata }: { metadata?: Metadata }) {
  const { request } = useRequest();

  // Resolve metadata from stack (hierarchical metadata from loaders)
  const stackMetadata = resolveMetadata();

  // Merge: stack metadata (parent) + provided metadata (child)
  // If metadata is provided, it overrides stack metadata
  // If not provided, use stack metadata only
  const resolvedMetadata = metadata ? mergeMetadata(stackMetadata, metadata) : stackMetadata;

  if (!resolvedMetadata) return null;

  // Helper to normalize title
  const getTitle = () => {
    if (!resolvedMetadata.title) return null;
    if (typeof resolvedMetadata.title === 'string') return resolvedMetadata.title;
    // Handle TemplateString
    return resolvedMetadata.title.default;
  };

  // Helper to normalize robots
  const getRobots = () => {
    // tránh tiêm query
    const queryNames = Object.keys(request.query || {});
    // mặc định nếu có query sẽ ép robots về noindex
    // tuy nhiên 1 số trường hợp đặc biệt ví dụ như page=1 có chủ đích `allowQueryNames` sẽ bỏ qua nguyên tắc này

    const noindex =
      queryNames.filter((name) => {
        if (typeof resolvedMetadata.robots === 'string') return false;
        if (Array.isArray(resolvedMetadata.robots?.allowQueryNames))
          return !resolvedMetadata.robots.allowQueryNames.includes(name);
        return name !== resolvedMetadata.robots?.allowQueryNames;
      }).length > 0;

    if (noindex) return 'noindex, follow';

    if (!resolvedMetadata.robots) return null;
    if (typeof resolvedMetadata.robots === 'string') return resolvedMetadata.robots;

    const parts: string[] = [];
    if (resolvedMetadata.robots.index === false) parts.push('noindex');
    else if (resolvedMetadata.robots.index === true) parts.push('index');

    if (resolvedMetadata.robots.follow === false) parts.push('nofollow');
    else if (resolvedMetadata.robots.follow === true) parts.push('follow');

    if (resolvedMetadata.robots.noarchive) parts.push('noarchive');
    if (resolvedMetadata.robots.nosnippet) parts.push('nosnippet');
    if (resolvedMetadata.robots.noimageindex) parts.push('noimageindex');
    if (resolvedMetadata.robots.nocache) parts.push('nocache');

    return parts.length > 0 ? parts.join(', ') : null;
  };

  // Helper to normalize viewport
  const getViewport = () => {
    if (!resolvedMetadata.viewport) return null;
    if (typeof resolvedMetadata.viewport === 'string') return resolvedMetadata.viewport;

    const parts: string[] = [];
    if (resolvedMetadata.viewport.width) parts.push(`width=${resolvedMetadata.viewport.width}`);
    if (resolvedMetadata.viewport.height) parts.push(`height=${resolvedMetadata.viewport.height}`);
    if (resolvedMetadata.viewport.initialScale)
      parts.push(`initial-scale=${resolvedMetadata.viewport.initialScale}`);
    if (resolvedMetadata.viewport.maximumScale)
      parts.push(`maximum-scale=${resolvedMetadata.viewport.maximumScale}`);
    if (resolvedMetadata.viewport.minimumScale)
      parts.push(`minimum-scale=${resolvedMetadata.viewport.minimumScale}`);
    if (resolvedMetadata.viewport.userScalable !== undefined) {
      parts.push(`user-scalable=${resolvedMetadata.viewport.userScalable ? 'yes' : 'no'}`);
    }

    return parts.length > 0 ? parts.join(', ') : null;
  };

  // Helper to normalize keywords
  const getKeywords = () => {
    if (!resolvedMetadata.keywords) return null;
    if (Array.isArray(resolvedMetadata.keywords)) return resolvedMetadata.keywords.join(', ');
    return resolvedMetadata.keywords;
  };

  // Helper to normalize authors
  const getAuthors = () => {
    if (!resolvedMetadata.author) return [];
    if (typeof resolvedMetadata.author === 'string') return [{ name: resolvedMetadata.author }];
    if (Array.isArray(resolvedMetadata.author)) return resolvedMetadata.author;
    return [resolvedMetadata.author];
  };

  // Helper to normalize format detection
  const getFormatDetection = () => {
    if (!resolvedMetadata.formatDetection) return null;

    const parts: string[] = [];
    if (resolvedMetadata.formatDetection.telephone === false) parts.push('telephone=no');
    if (resolvedMetadata.formatDetection.date === false) parts.push('date=no');
    if (resolvedMetadata.formatDetection.address === false) parts.push('address=no');
    if (resolvedMetadata.formatDetection.email === false) parts.push('email=no');

    return parts.length > 0 ? parts.join(', ') : null;
  };

  // Helper to normalize Open Graph images
  const getOgImages = () => {
    if (!resolvedMetadata.openGraph?.images) return [];

    const images = Array.isArray(resolvedMetadata.openGraph.images)
      ? resolvedMetadata.openGraph.images
      : [resolvedMetadata.openGraph.images];

    return images.map((img) => {
      if (typeof img === 'string') return { url: img };
      return img;
    });
  };

  // Helper to normalize Twitter images
  const getTwitterImages = () => {
    if (!resolvedMetadata.twitter?.images) return [];

    const images = Array.isArray(resolvedMetadata.twitter.images)
      ? resolvedMetadata.twitter.images
      : [resolvedMetadata.twitter.images];

    return images.map((img) => {
      if (typeof img === 'string') return { url: img };
      return img;
    });
  };

  // Helper to get icon URLs
  const getIcons = () => {
    if (!resolvedMetadata.icons) return { icon: [], apple: [], shortcut: null, other: [] };

    const iconUrls = resolvedMetadata.icons.icon
      ? Array.isArray(resolvedMetadata.icons.icon)
        ? resolvedMetadata.icons.icon
        : [resolvedMetadata.icons.icon]
      : [];

    const appleUrls = resolvedMetadata.icons.apple
      ? Array.isArray(resolvedMetadata.icons.apple)
        ? resolvedMetadata.icons.apple
        : [resolvedMetadata.icons.apple]
      : [];

    return {
      icon: iconUrls,
      apple: appleUrls,
      shortcut: resolvedMetadata.icons.shortcut || null,
      other: resolvedMetadata.icons.other || [],
    };
  };

  const title = getTitle();
  const robots = getRobots();
  const viewport = getViewport();
  const keywords = getKeywords();
  const authors = getAuthors();
  const formatDetection = getFormatDetection();
  const ogImages = getOgImages();
  const twitterImages = getTwitterImages();
  const icons = getIcons();
  const themeColors = Array.isArray(resolvedMetadata.themeColor)
    ? resolvedMetadata.themeColor
    : resolvedMetadata.themeColor
      ? [resolvedMetadata.themeColor]
      : [];

  return (
    <>
      {/* Critical: charset, viewport - must be first */}
      {(resolvedMetadata.charset || viewport) && (
        <Head priority={HEAD_PRIORITY.CRITICAL}>
          {resolvedMetadata.charset && <meta charset={resolvedMetadata.charset} />}
          {viewport && <meta name="viewport" content={viewport} />}
        </Head>
      )}

      {/* High priority: title, description, canonical, prev/next */}
      {(title ||
        resolvedMetadata.description ||
        resolvedMetadata.canonical ||
        resolvedMetadata.prev ||
        resolvedMetadata.next) && (
        <Head priority={HEAD_PRIORITY.HIGH}>
          {title && <title>{title}</title>}
          {resolvedMetadata.description && (
            <meta name="description" content={resolvedMetadata.description} />
          )}
          {resolvedMetadata.canonical && <link rel="canonical" href={resolvedMetadata.canonical} />}
          {resolvedMetadata.prev && <link rel="prev" href={resolvedMetadata.prev} />}
          {resolvedMetadata.next && <link rel="next" href={resolvedMetadata.next} />}
        </Head>
      )}

      {/* Medium priority: meta tags, robots */}
      <Head priority={HEAD_PRIORITY.MEDIUM}>
        {keywords && <meta name="keywords" content={keywords} />}
        {robots && <meta name="robots" content={robots} />}
        {resolvedMetadata.colorScheme && (
          <meta name="color-scheme" content={resolvedMetadata.colorScheme} />
        )}

        {/* Theme colors */}
        {themeColors.map((color, index) => (
          <meta name="theme-color" content={color} />
        ))}

        {resolvedMetadata.generator && (
          <meta name="generator" content={resolvedMetadata.generator} />
        )}
        {resolvedMetadata.creator && <meta name="creator" content={resolvedMetadata.creator} />}
        {resolvedMetadata.publisher && (
          <meta name="publisher" content={resolvedMetadata.publisher} />
        )}
        {resolvedMetadata.referrer && <meta name="referrer" content={resolvedMetadata.referrer} />}
        {resolvedMetadata.category && <meta name="category" content={resolvedMetadata.category} />}
        {resolvedMetadata.classification && (
          <meta name="classification" content={resolvedMetadata.classification} />
        )}
        {formatDetection && <meta name="format-detection" content={formatDetection} />}

        {/* Authors */}
        {authors.map((author, index) => (
          <Fragment>
            <meta name="author" content={author.name} />
            {author.url && <link rel="author" href={author.url} />}
          </Fragment>
        ))}

        {/* Icons */}
        {icons.icon.map((url, index) => (
          <link rel="icon" href={url} />
        ))}
        {icons.shortcut && <link rel="shortcut icon" href={icons.shortcut} />}
        {icons.apple.map((url, index) => (
          <link rel="apple-touch-icon" href={url} />
        ))}
        {icons.other.map((icon, index) => (
          <link
            rel={icon.rel || 'icon'}
            href={icon.url}
            {...(icon.sizes && { sizes: icon.sizes })}
            {...(icon.type && { type: icon.type })}
          />
        ))}

        {/* Manifest */}
        {resolvedMetadata.manifest && <link rel="manifest" href={resolvedMetadata.manifest} />}

        {/* Feeds */}
        {resolvedMetadata.feed && (
          <link rel="alternate" type="application/rss+xml" href={resolvedMetadata.feed} />
        )}

        {/* Verification */}
        {resolvedMetadata.verification?.google && (
          <meta name="google-site-verification" content={resolvedMetadata.verification.google} />
        )}
        {resolvedMetadata.verification?.yahoo && (
          <meta name="y_key" content={resolvedMetadata.verification.yahoo} />
        )}
        {resolvedMetadata.verification?.yandex && (
          <meta name="yandex-verification" content={resolvedMetadata.verification.yandex} />
        )}
        {resolvedMetadata.verification?.me &&
          (Array.isArray(resolvedMetadata.verification.me) ? (
            resolvedMetadata.verification.me.map((url, index) => <link rel="me" href={url} />)
          ) : (
            <link rel="me" href={resolvedMetadata.verification.me} />
          ))}
        {resolvedMetadata.verification?.other &&
          Object.entries(resolvedMetadata.verification.other).map(([key, value]) =>
            Array.isArray(value) ? (
              value.map((v, index) => <meta name={key} content={v} />)
            ) : (
              <meta name={key} content={value} />
            ),
          )}

        {/* App Links */}
        {resolvedMetadata.appLinks && (
          <Fragment>
            {resolvedMetadata.appLinks.ios?.url && (
              <meta property="al:ios:url" content={resolvedMetadata.appLinks.ios.url} />
            )}
            {resolvedMetadata.appLinks.ios?.app_store_id && (
              <meta
                property="al:ios:app_store_id"
                content={resolvedMetadata.appLinks.ios.app_store_id}
              />
            )}
            {resolvedMetadata.appLinks.ios?.app_name && (
              <meta property="al:ios:app_name" content={resolvedMetadata.appLinks.ios.app_name} />
            )}
            {resolvedMetadata.appLinks.android?.package && (
              <meta
                property="al:android:package"
                content={resolvedMetadata.appLinks.android.package}
              />
            )}
            {resolvedMetadata.appLinks.android?.app_name && (
              <meta
                property="al:android:app_name"
                content={resolvedMetadata.appLinks.android.app_name}
              />
            )}
            {resolvedMetadata.appLinks.android?.url && (
              <meta property="al:android:url" content={resolvedMetadata.appLinks.android.url} />
            )}
            {resolvedMetadata.appLinks.web?.url && (
              <meta property="al:web:url" content={resolvedMetadata.appLinks.web.url} />
            )}
            {resolvedMetadata.appLinks.web?.should_fallback !== undefined && (
              <meta
                property="al:web:should_fallback"
                content={String(resolvedMetadata.appLinks.web.should_fallback)}
              />
            )}
          </Fragment>
        )}

        {/* Additional meta tags */}
        {resolvedMetadata.other &&
          Object.entries(resolvedMetadata.other).map(([key, value]) =>
            Array.isArray(value) ? (
              value.map((v, index) => <meta name={key} content={String(v)} />)
            ) : (
              <meta name={key} content={String(value)} />
            ),
          )}
      </Head>

      {/* SEO: OpenGraph, Twitter - lower priority */}
      {(resolvedMetadata.openGraph || resolvedMetadata.twitter) && (
        <Head priority={HEAD_PRIORITY.SEO}>
          {/* Open Graph */}
          {resolvedMetadata.openGraph && (
            <Fragment>
              {resolvedMetadata.openGraph.title && (
                <meta property="og:title" content={resolvedMetadata.openGraph.title} />
              )}
              {resolvedMetadata.openGraph.description && (
                <meta property="og:description" content={resolvedMetadata.openGraph.description} />
              )}
              {resolvedMetadata.openGraph.type && (
                <meta property="og:type" content={resolvedMetadata.openGraph.type} />
              )}
              {resolvedMetadata.openGraph.url && (
                <meta property="og:url" content={resolvedMetadata.openGraph.url} />
              )}
              {resolvedMetadata.openGraph.siteName && (
                <meta property="og:site_name" content={resolvedMetadata.openGraph.siteName} />
              )}
              {resolvedMetadata.openGraph.locale && (
                <meta property="og:locale" content={resolvedMetadata.openGraph.locale} />
              )}
              {resolvedMetadata.openGraph.alternateLocale &&
                (Array.isArray(resolvedMetadata.openGraph.alternateLocale) ? (
                  resolvedMetadata.openGraph.alternateLocale.map((locale, index) => (
                    <meta property="og:locale:alternate" content={locale} />
                  ))
                ) : (
                  <meta
                    property="og:locale:alternate"
                    content={resolvedMetadata.openGraph.alternateLocale}
                  />
                ))}
              {resolvedMetadata.openGraph.determiner && (
                <meta property="og:determiner" content={resolvedMetadata.openGraph.determiner} />
              )}

              {/* OG Images */}
              {ogImages.map((image, index) => (
                <Fragment>
                  <meta property="og:image" content={image.url} />
                  {image.secureUrl && (
                    <meta property="og:image:secure_url" content={image.secureUrl} />
                  )}
                  {image.alt && <meta property="og:image:alt" content={image.alt} />}
                  {image.type && <meta property="og:image:type" content={image.type} />}
                  {image.width && <meta property="og:image:width" content={String(image.width)} />}
                  {image.height && (
                    <meta property="og:image:height" content={String(image.height)} />
                  )}
                </Fragment>
              ))}

              {/* Article specific */}
              {resolvedMetadata.openGraph.publishedTime && (
                <meta
                  property="article:published_time"
                  content={resolvedMetadata.openGraph.publishedTime}
                />
              )}
              {resolvedMetadata.openGraph.modifiedTime && (
                <meta
                  property="article:modified_time"
                  content={resolvedMetadata.openGraph.modifiedTime}
                />
              )}
              {resolvedMetadata.openGraph.expirationTime && (
                <meta
                  property="article:expiration_time"
                  content={resolvedMetadata.openGraph.expirationTime}
                />
              )}
              {resolvedMetadata.openGraph.authors &&
                (Array.isArray(resolvedMetadata.openGraph.authors) ? (
                  resolvedMetadata.openGraph.authors.map((author, index) => (
                    <meta property="article:author" content={author} />
                  ))
                ) : (
                  <meta property="article:author" content={resolvedMetadata.openGraph.authors} />
                ))}
              {resolvedMetadata.openGraph.section && (
                <meta property="article:section" content={resolvedMetadata.openGraph.section} />
              )}
              {resolvedMetadata.openGraph.tags &&
                (Array.isArray(resolvedMetadata.openGraph.tags) ? (
                  resolvedMetadata.openGraph.tags.map((tag, index) => (
                    <meta property="article:tag" content={tag} />
                  ))
                ) : (
                  <meta property="article:tag" content={resolvedMetadata.openGraph.tags} />
                ))}

              {/* Book specific */}
              {resolvedMetadata.openGraph.isbn && (
                <meta property="book:isbn" content={resolvedMetadata.openGraph.isbn} />
              )}
              {resolvedMetadata.openGraph.releaseDate && (
                <meta
                  property="book:release_date"
                  content={resolvedMetadata.openGraph.releaseDate}
                />
              )}

              {/* Profile specific */}
              {resolvedMetadata.openGraph.firstName && (
                <meta
                  property="profile:first_name"
                  content={resolvedMetadata.openGraph.firstName}
                />
              )}
              {resolvedMetadata.openGraph.lastName && (
                <meta property="profile:last_name" content={resolvedMetadata.openGraph.lastName} />
              )}
              {resolvedMetadata.openGraph.username && (
                <meta property="profile:username" content={resolvedMetadata.openGraph.username} />
              )}
              {resolvedMetadata.openGraph.gender && (
                <meta property="profile:gender" content={resolvedMetadata.openGraph.gender} />
              )}
            </Fragment>
          )}

          {/* Twitter Card */}
          {resolvedMetadata.twitter && (
            <Fragment>
              {resolvedMetadata.twitter.card && (
                <meta name="twitter:card" content={resolvedMetadata.twitter.card} />
              )}
              {resolvedMetadata.twitter.site && (
                <meta name="twitter:site" content={resolvedMetadata.twitter.site} />
              )}
              {resolvedMetadata.twitter.siteId && (
                <meta name="twitter:site:id" content={resolvedMetadata.twitter.siteId} />
              )}
              {resolvedMetadata.twitter.creator && (
                <meta name="twitter:creator" content={resolvedMetadata.twitter.creator} />
              )}
              {resolvedMetadata.twitter.creatorId && (
                <meta name="twitter:creator:id" content={resolvedMetadata.twitter.creatorId} />
              )}
              {resolvedMetadata.twitter.title && (
                <meta name="twitter:title" content={resolvedMetadata.twitter.title} />
              )}
              {resolvedMetadata.twitter.description && (
                <meta name="twitter:description" content={resolvedMetadata.twitter.description} />
              )}

              {/* Twitter Images */}
              {twitterImages.map((image, index) => (
                <Fragment>
                  <meta name="twitter:image" content={image.url} />
                  {image.alt && <meta name="twitter:image:alt" content={image.alt} />}
                </Fragment>
              ))}

              {/* Twitter App */}
              {resolvedMetadata.twitter.app && (
                <Fragment>
                  {resolvedMetadata.twitter.app.name && (
                    <meta name="twitter:app:name" content={resolvedMetadata.twitter.app.name} />
                  )}
                  {resolvedMetadata.twitter.app.id.iphone && (
                    <meta
                      name="twitter:app:id:iphone"
                      content={resolvedMetadata.twitter.app.id.iphone}
                    />
                  )}
                  {resolvedMetadata.twitter.app.id.ipad && (
                    <meta
                      name="twitter:app:id:ipad"
                      content={resolvedMetadata.twitter.app.id.ipad}
                    />
                  )}
                  {resolvedMetadata.twitter.app.id.googleplay && (
                    <meta
                      name="twitter:app:id:googleplay"
                      content={resolvedMetadata.twitter.app.id.googleplay}
                    />
                  )}
                  {resolvedMetadata.twitter.app.url?.iphone && (
                    <meta
                      name="twitter:app:url:iphone"
                      content={resolvedMetadata.twitter.app.url.iphone}
                    />
                  )}
                  {resolvedMetadata.twitter.app.url?.ipad && (
                    <meta
                      name="twitter:app:url:ipad"
                      content={resolvedMetadata.twitter.app.url.ipad}
                    />
                  )}
                  {resolvedMetadata.twitter.app.url?.googleplay && (
                    <meta
                      name="twitter:app:url:googleplay"
                      content={resolvedMetadata.twitter.app.url.googleplay}
                    />
                  )}
                </Fragment>
              )}
            </Fragment>
          )}
        </Head>
      )}
    </>
  );
}
