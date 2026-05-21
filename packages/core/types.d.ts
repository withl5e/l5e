// Minimal global JSX types for consumers of L5E.
// This file intentionally avoids imports to ensure it loads cleanly everywhere
// For internal use, prefer src/core/jsx-types.d.ts which has full type definitions
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
    // Use any for external consumers, but internal files should use jsx-types.d.ts
    type Element = any;
  }
}

export {};
