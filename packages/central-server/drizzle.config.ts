import { defineConfig } from "drizzle-kit"

const url =
  process.env["BYCONVO_DATABASE_URL"] ??
  "postgres://byconvo:byconvo@localhost:5432/byconvo"

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
})
