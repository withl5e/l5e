import type { Metadata } from './types';

/**
 * Merges parent and child metadata objects
 * Follows Next.js shallow merge pattern with deep merge for nested objects
 *
 * @param parent - Parent metadata (from layout/global loader)
 * @param child - Child metadata (from page/view loader)
 * @returns Merged metadata object
 */
export function mergeMetadata(
  parent: Metadata | null | undefined,
  child: Metadata | null | undefined,
): Metadata {
  // If no parent, return child (or empty object)
  if (!parent) {
    return child || {};
  }

  // If no child, return parent
  if (!child) {
    return parent;
  }

  // Shallow merge base properties (child overrides parent)
  const merged: Metadata = {
    ...parent,
    ...child,
  };

  // Deep merge for nested objects
  // OpenGraph: merge nested properties
  if (child.openGraph || parent.openGraph) {
    if (child.openGraph && parent.openGraph) {
      merged.openGraph = {
        ...parent.openGraph,
        ...child.openGraph,
        // Deep merge for nested arrays/objects in openGraph
        images: child.openGraph.images ?? parent.openGraph.images,
        videos: child.openGraph.videos ?? parent.openGraph.videos,
        audio: child.openGraph.audio ?? parent.openGraph.audio,
        alternateLocale: child.openGraph.alternateLocale ?? parent.openGraph.alternateLocale,
        authors: child.openGraph.authors ?? parent.openGraph.authors,
        tags: child.openGraph.tags ?? parent.openGraph.tags,
      };
    } else {
      merged.openGraph = child.openGraph || parent.openGraph;
    }
  }

  // Twitter: merge nested properties
  if (child.twitter || parent.twitter) {
    if (child.twitter && parent.twitter) {
      merged.twitter = {
        ...parent.twitter,
        ...child.twitter,
        // Deep merge for nested objects
        images: child.twitter.images ?? parent.twitter.images,
        app: child.twitter.app
          ? {
              ...parent.twitter.app,
              ...child.twitter.app,
              id: {
                ...parent.twitter.app?.id,
                ...child.twitter.app.id,
              },
              url: {
                ...parent.twitter.app?.url,
                ...child.twitter.app.url,
              },
            }
          : parent.twitter.app,
      };
    } else {
      merged.twitter = child.twitter || parent.twitter;
    }
  }

  // Icons: merge nested properties
  if (child.icons || parent.icons) {
    if (child.icons && parent.icons) {
      merged.icons = {
        icon: child.icons.icon ?? parent.icons.icon,
        shortcut: child.icons.shortcut ?? parent.icons.shortcut,
        apple: child.icons.apple ?? parent.icons.apple,
        other: child.icons.other ?? parent.icons.other,
      };
    } else {
      merged.icons = child.icons || parent.icons;
    }
  }

  // Verification: merge nested properties
  if (child.verification || parent.verification) {
    if (child.verification && parent.verification) {
      merged.verification = {
        ...parent.verification,
        ...child.verification,
        // Deep merge for other verification tags
        other: child.verification.other
          ? {
              ...parent.verification.other,
              ...child.verification.other,
            }
          : parent.verification.other,
        me: child.verification.me ?? parent.verification.me,
      };
    } else {
      merged.verification = child.verification || parent.verification;
    }
  }

  // AppLinks: merge nested properties
  if (child.appLinks || parent.appLinks) {
    if (child.appLinks && parent.appLinks) {
      merged.appLinks = {
        ios: child.appLinks.ios
          ? {
              ...parent.appLinks.ios,
              ...child.appLinks.ios,
            }
          : parent.appLinks.ios,
        android: child.appLinks.android
          ? {
              ...parent.appLinks.android,
              ...child.appLinks.android,
            }
          : parent.appLinks.android,
        web: child.appLinks.web
          ? {
              ...parent.appLinks.web,
              ...child.appLinks.web,
            }
          : parent.appLinks.web,
      };
    } else {
      merged.appLinks = child.appLinks || parent.appLinks;
    }
  }

  // FormatDetection: merge nested properties
  if (child.formatDetection || parent.formatDetection) {
    if (child.formatDetection && parent.formatDetection) {
      merged.formatDetection = {
        ...parent.formatDetection,
        ...child.formatDetection,
      };
    } else {
      merged.formatDetection = child.formatDetection || parent.formatDetection;
    }
  }

  // Viewport: merge if both are objects
  if (child.viewport && parent.viewport) {
    if (typeof child.viewport === 'object' && typeof parent.viewport === 'object') {
      merged.viewport = {
        ...parent.viewport,
        ...child.viewport,
      } as Metadata['viewport'];
    } else {
      // If either is string, child overrides
      merged.viewport = child.viewport;
    }
  }

  // Robots: merge if both are objects
  if (child.robots && parent.robots) {
    if (typeof child.robots === 'object' && typeof parent.robots === 'object') {
      merged.robots = {
        ...parent.robots,
        ...child.robots,
      } as Metadata['robots'];
    } else {
      // If either is string, child overrides
      merged.robots = child.robots;
    }
  }

  // Array fields: child overrides parent (shallow merge behavior)
  // These are already handled by spread operator above
  // But we explicitly handle them for clarity:
  merged.keywords = child.keywords ?? parent.keywords;
  merged.themeColor = child.themeColor ?? parent.themeColor;
  merged.archives = child.archives ?? parent.archives;
  merged.assets = child.assets ?? parent.assets;

  // Other: merge objects
  if (child.other || parent.other) {
    if (child.other && parent.other) {
      merged.other = {
        ...parent.other,
        ...child.other,
      };
    } else {
      merged.other = child.other || parent.other;
    }
  }

  return merged;
}
