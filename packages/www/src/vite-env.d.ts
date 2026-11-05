/// <reference types="vite/client" />

/** The Worker's bindings, as wrangler.jsonc declares them. */
declare module "cloudflare:workers" {
  export const env: {
    /** A D1 database; only the calls the waitlist makes. */
    WAITLIST: {
      exec: (query: string) => Promise<unknown>;
      prepare: (query: string) => {
        bind: (...values: Array<unknown>) => { run: () => Promise<unknown> };
      };
    };
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_SECRET_KEY?: string;
  };
}

/** Cloudflare Turnstile's browser API, once its script has loaded. */
interface Window {
  turnstile?: {
    render: (
      container: HTMLElement,
      options: {
        sitekey: string;
        appearance?: "always" | "execute" | "interaction-only";
        action?: string;
        callback: (token: string) => void;
        "error-callback"?: () => void;
        "expired-callback"?: () => void;
      }
    ) => string;
    reset: (widgetId: string) => void;
    remove: (widgetId: string) => void;
  };
}
