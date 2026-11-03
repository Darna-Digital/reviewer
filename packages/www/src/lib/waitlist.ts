import { createServerFn } from "@tanstack/react-start";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Adds an address to the Reviewer Cloud waitlist, kept in the Worker's
 * `WAITLIST` KV namespace under the lowercased address.
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
    await env.WAITLIST.put(
      data.email,
      JSON.stringify({ joinedAt: new Date().toISOString() })
    );
    return { ok: true as const };
  });
