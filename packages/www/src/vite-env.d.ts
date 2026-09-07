/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Where the cloud API lives, without a trailing slash. Empty (the default)
   * means same-origin: in development Vite proxies `/api` to the server, in
   * production the site and the API share a domain or this is set at build
   * time, e.g. `https://api.reviewer.darnadigital.com`.
   */
  readonly VITE_REVIEWER_CLOUD_API?: string;
}
