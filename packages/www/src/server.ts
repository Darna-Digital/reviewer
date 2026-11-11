// The Worker's entry: TanStack Start's own for requests, and the daily cron
// (wrangler.jsonc's triggers) that keeps the usage counts in D1 past
// Analytics Engine's three months (see lib/usage-rollup.ts).
import handler from "@tanstack/react-start/server-entry";

import { rollUpUsage } from "#/lib/usage-rollup";
import type { RollupEnv } from "#/lib/usage-rollup";

export default {
  fetch: handler.fetch,
  scheduled(
    _controller: unknown,
    env: RollupEnv,
    ctx: { waitUntil: (promise: Promise<unknown>) => void }
  ) {
    ctx.waitUntil(rollUpUsage(env));
  },
};
