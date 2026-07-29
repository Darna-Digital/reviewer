/**
 * Applies the generated migrations, then exits. Run by `pnpm db:migrate` and
 * by the server's own startup check, so a fresh clone only has to bring
 * Postgres up.
 */
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { Pool } from "pg"
import { databaseUrl } from "./client.ts"

const migrationsFolder = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "drizzle"
)

export const runMigrations = async (): Promise<void> => {
  const pool = new Pool({ connectionString: databaseUrl(), max: 1 })
  try {
    await migrate(drizzle(pool), { migrationsFolder })
  } finally {
    await pool.end()
  }
}

const isEntryPoint =
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`

if (isEntryPoint) {
  runMigrations().then(
    () => {
      console.log("migrations applied")
      process.exit(0)
    },
    (error: unknown) => {
      console.error("migration failed:", error)
      process.exit(1)
    }
  )
}
