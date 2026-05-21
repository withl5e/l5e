/// <reference types="vite/client" />

declare module 'virtual:l5e-actions' {
  export const viewActions: Record<string, () => Promise<Record<string, unknown>>>;
}
