# Byconvo

Tools for conversation-based development.

Byconvo is a local desktop workspace for directing coding agents and reviewing
their work. It brings conversations, plans, tasks, terminals, browser previews,
and Git changes together so agent-assisted development stays visible and easy
to verify.

## Getting started

### Prerequisites

- Git
- Node.js LTS
- [pnpm](https://pnpm.io/) 11.7.0

Install the workspace dependencies and launch the desktop app in development
mode:

```bash
pnpm install
pnpm dev:desktop
```

To run the API server and web client without Electron instead:

```bash
pnpm dev
```

The web client is available at `http://localhost:41812`; it proxies API and
terminal connections to the embedded server on port `41811`.

## Useful commands

| Command | Description |
| --- | --- |
| `pnpm build` | Build every workspace package |
| `pnpm typecheck` | Type-check every workspace package |
| `pnpm lint` | Run ESLint across the workspace |
| `pnpm format:check` | Check formatting across the workspace |
| `pnpm -r --if-present test` | Run all package test suites |
| `pnpm build:desktop` | Build the server, web client, and Electron shell |
| `pnpm pack:desktop` | Create an unpacked desktop application |

## Repository structure

| Package | Purpose |
| --- | --- |
| `packages/core` | Infrastructure-independent schemas, services, and repositories |
| `packages/embedded-server` | Local API server backed by Git, SQLite, and the filesystem |
| `packages/spa` | React and TanStack Start client |
| `packages/desktop` | Electron desktop shell |
| `packages/feature-flags` | Shared feature switches |
| `packages/lint` | Shared ESLint and Prettier configuration |

See [RELEASING.md](RELEASING.md) for the desktop release process.
