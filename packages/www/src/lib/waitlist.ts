import { createServerFn } from "@tanstack/react-start";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Cloudflare's always-passing test secret, for `pnpm dev`. A deployed Worker
 * reads the real one from its `TURNSTILE_SECRET_KEY` secret.
 */
const TEST_SECRET = "1x0000000000000000000000000000000AA";
/** The matching always-passing test site key. */
const TEST_SITE_KEY = "1x00000000000000000000AA";

/** Created on the first signup an isolate sees, so a deploy needs no migration. */
const SCHEMA = `CREATE TABLE IF NOT EXISTS waitlist (
  email TEXT PRIMARY KEY,
  joined_at TEXT NOT NULL
)`;
let schemaReady: Promise<unknown> | undefined;

/** Asks Turnstile whether the token came from a person on this site. */
async function isHuman(token: string, secret: string, ip: string | undefined) {
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body }
  );
  const result: { success?: boolean } = await response.json();
  return result.success === true;
}

/**
 * Adds an address to the Reviewer Cloud waitlist, a row in the Worker's
 * `WAITLIST` D1 database keyed by the lowercased address. The form's Turnstile
 * token must check out first.
 */
export const joinWaitlist = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const record =
      typeof data === "object" && data !== null
        ? (data as Record<string, unknown>)
        : {};
    const email = String(record.email ?? "")
      .trim()
      .toLowerCase();
    if (!EMAIL.test(email) || email.length > 254) {
      throw new Error("Enter an email address.");
    }
    return { email, token: String(record.token ?? "") };
  })
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const { getRequestHeader } = await import("@tanstack/react-start/server");

    const secret =
      // The real keys only work on reviewer.sh, so dev always uses the test ones.
      import.meta.env.DEV ? TEST_SECRET : env.TURNSTILE_SECRET_KEY;
    if (!secret) throw new Error("Signups are closed right now. Try later.");
    const human =
      data.token !== "" &&
      (await isHuman(data.token, secret, getRequestHeader("cf-connecting-ip")));
    if (!human) {
      throw new Error("We couldn't check that you're human. Try again.");
    }

    schemaReady ??= env.WAITLIST.exec(SCHEMA.replace(/\n\s*/g, " "));
    await schemaReady;
    await env.WAITLIST.prepare(
      "INSERT INTO waitlist (email, joined_at) VALUES (?, ?) ON CONFLICT (email) DO NOTHING"
    )
      .bind(data.email, new Date().toISOString())
      .run();
    return { ok: true as const };
  });

/** The public Turnstile site key the form renders its check with. */
export const getTurnstileSiteKey = createServerFn({ method: "GET" }).handler(
  async () => {
    const { env } = await import("cloudflare:workers");
    return import.meta.env.DEV ? TEST_SITE_KEY : (env.TURNSTILE_SITE_KEY ?? "");
  }
);
