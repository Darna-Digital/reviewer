/// <reference types="vite/client" />

/** The Worker's bindings, as wrangler.jsonc declares them. */
declare module "cloudflare:workers" {
  export const env: {
    WAITLIST: { put: (key: string, value: string) => Promise<void> };
  };
}
