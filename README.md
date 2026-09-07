# reviewer

## Tools for conversation based development.

### Engineered for writing reliable, maintainable and testable code 

I needed a tool that would help me use agents for writing code for clients. Reviewer is that tool.

## Packages

| Package                    | What it is                                                                       |
| -------------------------- | -------------------------------------------------------------------------------- |
| `packages/spa`             | The app itself — the review, plans and chat interface                            |
| `packages/embedded-server` | The local server the app talks to: git, the filesystem, agent processes          |
| `packages/desktop`         | The Electron shell the two ship in                                               |
| `packages/core`            | Infra-agnostic feature schemas, services and ports, with tests                   |
| `packages/feature-flags`   | The flags the app reads                                                          |
| `packages/www`             | reviewer.darnadigital.com — the marketing site, on Cloudflare Workers            |
| `packages/lint`            | Shared ESLint and Prettier rules                                                 |

```sh
pnpm install
pnpm dev        # the embedded server and the app
pnpm dev:www    # the marketing site on :41822
pnpm desktop    # the desktop app
```

The marketing site deploys on its own, by wrangler — `pnpm deploy:www`, or
`.github/workflows/deploy-www.yml` on a push to `main` that touches it. See
`packages/www/README.md`.
