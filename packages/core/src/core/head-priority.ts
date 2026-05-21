/**
 * Priority constants for Head component rendering order
 * Lower numbers render first (higher priority)
 */
export const HEAD_PRIORITY = {
  CRITICAL: 0, // charset, viewport - must be first
  HIGH: 10, // title, description, canonical
  MEDIUM: 50, // meta tags, robots
  SEO: 80, // OpenGraph, Twitter
  LOW: 100, // Custom head elements
  SCRIPTS: 200, // Scripts
  STYLES: 300, // Styles
} as const;

export type HeadPriority = (typeof HEAD_PRIORITY)[keyof typeof HEAD_PRIORITY] | number;
