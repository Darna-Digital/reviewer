# @byconvo/central-server

The shared, multi-tenant half of byconvo: projects, issues, docs, labels and
their comments, plus the sessions and organizations that scope them.

Where `@byconvo/embedded-server` reads one developer's git checkout and stores
what it needs beside it, this one is shared — several people, several clients,
one Postgres. That is the whole reason it exists separately: a workspace
outlives any single checkout.

## Running it

```bash
pnpm db:up        # Postgres in Docker (byconvo/byconvo on :5432)
pnpm dev          # migrates, then serves on :41821
```

From the repository root, `pnpm dev` starts this alongside the embedded server
and the SPA. Migrations run at startup, so a fresh clone only has to bring
Postgres up.

Against an existing Postgres, point `BYCONVO_DATABASE_URL` at it instead of
running `db:up`.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `BYCONVO_DATABASE_URL` | `postgres://byconvo:byconvo@localhost:5432/byconvo` | Postgres connection |
| `BYCONVO_CENTRAL_PORT` | `41821` | Port to serve on |
| `BYCONVO_CENTRAL_URL` | `http://localhost:41821` | This server's own origin, used to build auth URLs |
| `BYCONVO_APP_URL` | `http://localhost:41812` | Where the SPA is served; the links in emails point here |
| `BYCONVO_AUTH_SECRET` | a development key | Signs sessions. **Required** when `NODE_ENV=production` |
| `SMTP_HOST` … `SMTP_FROM` | unset | SMTP delivery; with no host, mail is printed to stdout |

With no `SMTP_HOST`, verification and invitation emails are printed to the
console — including the link — so a fresh clone can sign up and verify without
any third-party account.

## Layout

```
src/
  api.ts            the HttpApi, served under /api
  services.ts       per-request services: a core service over a drizzle repository
  auth/             better-auth, and the viewer a request acts as
  db/               drizzle schema, connection, migrations
  layers/<feature>/ api + handler + drizzle repository
  mail/             the Mailer port's transports
```

The domain rules live in `@byconvo/core` and are tested there against in-memory
repositories. What is tested *here* is the half that only exists here — tenant
scoping, the per-project task-number sequence, and the cascades — against a
real database (`src/layers/repositories.test.ts`, skipped when none is
reachable).

## Schema changes

```bash
pnpm db:generate   # diff src/db/schema.ts into drizzle/
pnpm db:migrate    # apply
```

`src/db/schema.ts` holds both halves of the schema: better-auth's tables (whose
shape the library dictates) and the workspace domain. Every domain row carries
the organization it belongs to, and every foreign key into another tenant-owned
table cascades.

## Notes

Drizzle has no Effect v4 binding yet — `@effect/sql-drizzle` is still pinned to
Effect 3 — so `db/client.ts` wraps drizzle's own `node-postgres` driver instead.
It is the single place a driver rejection becomes a typed `StorageError`; no
repository sees a promise and no service sees SQL.
