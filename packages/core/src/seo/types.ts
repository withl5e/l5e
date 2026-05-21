// Basic metadata types
export type Author = { name: string; url?: string };

export interface Metadata {
  // Basic meta tags
  charset?: string;
  title?: string | TemplateString;
  description?: string;
  keywords?: string | string[];
  author?: string | Author | Author[];

  // URL and canonical
  canonical?: string;

  // Robots and indexing
  robots?:
    | string
    | {
        index?: boolean;
        follow?: boolean;
        noarchive?: boolean;
        nosnippet?: boolean;
        noimageindex?: boolean;
        nocache?: boolean;
        allowQueryNames?: string | string[];
      };

  // Viewport
  viewport?:
    | string
    | {
        width?: string | number;
        height?: string | number;
        initialScale?: number;
        maximumScale?: number;
        minimumScale?: number;
        userScalable?: boolean;
      };

  // Theme and colors
  themeColor?: string | string[];
  colorScheme?: 'light' | 'dark' | 'light dark' | 'dark light';

  // Icons
  icons?: {
    icon?: string | string[];
    shortcut?: string;
    apple?: string | string[];
    other?: Array<{
      rel?: string;
      url: string;
      sizes?: string;
      type?: string;
    }>;
  };

  // Application specific
  generator?: string;
  creator?: string;
  publisher?: string;
  referrer?:
    | 'no-referrer'
    | 'origin'
    | 'no-referrer-when-downgrade'
    | 'origin-when-cross-origin'
    | 'same-origin'
    | 'strict-origin'
    | 'strict-origin-when-cross-origin'
    | 'unsafe-url';

  // Pagination links
  prev?: string;
  next?: string;

  // Format detection
  formatDetection?: {
    telephone?: boolean;
    date?: boolean;
    address?: boolean;
    email?: boolean;
  };

  // Open Graph
  openGraph?: {
    type?:
      | 'website'
      | 'article'
      | 'book'
      | 'profile'
      | 'music.song'
      | 'music.album'
      | 'music.playlist'
      | 'music.radio_station'
      | 'video.movie'
      | 'video.episode'
      | 'video.tv_show'
      | 'video.other';
    title?: string;
    description?: string;
    siteName?: string;
    url?: string;
    locale?: string;
    alternateLocale?: string | string[];
    images?: string | OpenGraphImage | Array<string | OpenGraphImage>;
    videos?: string | OpenGraphVideo | Array<string | OpenGraphVideo>;
    audio?: string | OpenGraphAudio | Array<string | OpenGraphAudio>;
    determiner?: 'a' | 'an' | 'the' | 'auto' | '';

    // Article specific
    publishedTime?: string;
    modifiedTime?: string;
    expirationTime?: string;
    authors?: string | string[];
    section?: string;
    tags?: string | string[];

    // Book specific
    isbn?: string;
    releaseDate?: string;

    // Profile specific
    firstName?: string;
    lastName?: string;
    username?: string;
    gender?: string;
  };

  // Twitter Card
  twitter?: {
    card?: 'summary' | 'summary_large_image' | 'app' | 'player';
    site?: string;
    siteId?: string;
    creator?: string;
    creatorId?: string;
    title?: string;
    description?: string;
    images?: string | TwitterImage | Array<string | TwitterImage>;
    app?: {
      id: {
        iphone?: string;
        ipad?: string;
        googleplay?: string;
      };
      url?: {
        iphone?: string;
        ipad?: string;
        googleplay?: string;
      };
      name?: string;
    };
  };

  // Verification
  verification?: {
    google?: string;
    yahoo?: string;
    yandex?: string;
    me?: string | string[];
    other?: Record<string, string | string[]>;
  };

  // App Links
  appLinks?: {
    ios?: {
      url?: string;
      app_store_id?: string;
      app_name?: string;
    };
    android?: {
      package?: string;
      app_name?: string;
      url?: string;
    };
    web?: {
      url?: string;
      should_fallback?: boolean;
    };
  };

  // Additional meta tags
  other?: Record<string, string | number | string[]>;

  // Archives (for blog posts, etc.)
  archives?: string | string[];

  // Assets and manifests
  assets?: string | string[];
  manifest?: string;

  feed?: string;

  // Category
  category?: string;

  // Classification
  classification?: string;
}

export interface OpenGraphImage {
  url: string;
  secureUrl?: string;
  alt?: string;
  type?: string;
  width?: string | number;
  height?: string | number;
}

export interface OpenGraphVideo {
  url: string;
  secureUrl?: string;
  type?: string;
  width?: string | number;
  height?: string | number;
}

export interface OpenGraphAudio {
  url: string;
  secureUrl?: string;
  type?: string;
}

export interface TwitterImage {
  url: string;
  alt?: string;
}

export interface TemplateString {
  default: string;
  template?: string;
  absolute?: boolean;
}

// For dynamic metadata generation
export interface ResolvingMetadata extends Promise<Metadata> {}

// Page props type for generateMetadata
export interface MetadataProps<
  Params = Record<string, string | string[]>,
  SearchParams = Record<string, string | string[] | undefined>,
> {
  params?: Params;
  searchParams?: SearchParams;
}

// Schema.org types for structured data
export interface OrganizationSchema {
  '@context': 'https://schema.org';
  '@type': 'Organization';
  name: string;
  url: string;
  logo?: string;
  description?: string;
  sameAs?: string[]; // Social media profiles
  contactPoint?: {
    '@type': 'ContactPoint';
    email?: string;
    contactType?: string;
    availableLanguage?: string[];
  };
  address?: {
    '@type': 'PostalAddress';
    addressCountry?: string;
    addressLocality?: string;
  };
}

export interface WebSiteSchema {
  '@context': 'https://schema.org';
  '@type': 'WebSite';
  name: string;
  url: string;
  description?: string;
  inLanguage?: string;
  potentialAction?: {
    '@type': 'SearchAction';
    target: {
      '@type': 'EntryPoint';
      urlTemplate: string;
    };
    'query-input': string;
  };
}

export interface BreadcrumbSchema {
  '@context': 'https://schema.org';
  '@type': 'BreadcrumbList';
  itemListElement: Array<{
    '@type': 'ListItem';
    position: number;
    name: string;
    item?: string;
  }>;
}

export interface WebPageSchema {
  '@context': 'https://schema.org';
  '@type': 'WebPage';
  name: string;
  url: string;
  description?: string;
  inLanguage?: string;
  isPartOf?: {
    '@type': 'WebSite';
    '@id': string;
  };
  about?: {
    '@type': 'Thing';
    name: string;
  };
  primaryImageOfPage?: {
    '@type': 'ImageObject';
    url: string;
    width?: number;
    height?: number;
  };
}
