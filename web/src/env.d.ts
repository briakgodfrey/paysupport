/// <reference types="vite/client" />

/**
 * Build-time configuration exposed through Vite. Only VITE_-prefixed
 * variables reach the bundle, and they are public: never add secrets here.
 */
interface ImportMetaEnv {
  /** Base URL for API requests. Defaults to "/api" (the dev proxy) when unset. */
  readonly VITE_API_BASE_URL?: string;
  /** "true" only in the browser-only demo build, where a mock in the browser stands in for the API. */
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
