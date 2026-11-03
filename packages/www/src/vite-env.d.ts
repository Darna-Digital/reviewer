/// <reference types="vite/client" />

/** The Worker's bindings. `WAITLIST` is a KV namespace, once one is bound. */
declare module "cloudflare:workers" {
  export const env: {
    WAITLIST?: { put: (key: string, value: string) => Promise<void> };
  };
}
