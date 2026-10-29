/**
 * Write the API's OpenAPI document to a file without starting the server —
 * the same document `/api/openapi.json` serves, for generating the SPA's
 * client types (`pnpm --filter spa gen:api:offline`).
 */
import { writeFileSync } from "node:fs";
import { OpenApi } from "effect/http-api";
import { Api } from "../src/api.ts";

const out = process.argv[2];
if (out === undefined) {
  console.error("usage: write-openapi <out.json>");
  process.exit(1);
}
writeFileSync(out, JSON.stringify(OpenApi.fromApi(Api), null, 2));
