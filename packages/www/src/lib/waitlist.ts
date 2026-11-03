import { createServerFn } from "@tanstack/react-start";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Adds an address to the Reviewer Cloud waitlist, kept in the Worker's
 * `WAITLIST` KV namespace under the lowercased address. Until that binding
 * exists, the dev server only logs the address so the form can be tried,
 * and a deployed site refuses rather than pretend it kept it.
 */
export const joinWaitlist = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const email =
      typeof data === "object" && data !== null && "email" in data
        ? String(data.email).trim().toLowerCase()
        : "";
    if (!EMAIL.test(email) || email.length > 254) {
      throw new Error("Enter an email address.");
    }
    return { email };
  })
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    if (env.WAITLIST) {
      await env.WAITLIST.put(
        data.email,
        JSON.stringify({ joinedAt: new Date().toISOString() })
      );
    } else if (import.meta.env.DEV) {
      console.log(`[waitlist] ${data.email} (no WAITLIST binding; not kept)`);
    } else {
      throw new Error("The waitlist isn't taking addresses yet.");
    }
    return { ok: true as const };
  });
