# Byconvo

Tools for conversation-based development.

Byconvo is a local workspace for building software with coding agents. It keeps
the conversation, the code, and the review loop together so you can inspect
changes, leave precise feedback, and move work forward without losing context.

## What it does

- Run conversations with Claude Code, Codex, Cursor Agent, or OpenCode using
  the CLI and credentials already installed on your machine.
- Review working-tree changes, branches, worktrees, commits, and GitHub pull
  requests in a focused diff view.
- Attach comments to code and visual previews, then hand that context back to
  an agent.
- Edit files with language-aware diagnostics, completions, and find-usages
  support.
- Keep plans, tasks, terminals, and local development processes beside the
  code they belong to.

Byconvo runs locally and launches your own agent CLIs. App state is stored in
`~/.byconvo/byconvo.db`; plan documents are plain Markdown files under the
selected repository's `.byconvo/docs` directory.

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) (the current LTS release)
- [pnpm](https://pnpm.io/) 11.7.0
- [Git](https://git-scm.com/)
- At least one supported agent CLI, installed and authenticated, if you want to
  run agent conversations
- [GitHub CLI](https://cli.github.com/) authenticated with `gh auth login`, or
  a `GITHUB_TOKEN`/`GH_TOKEN`, if you want to review pull requests

Install the workspace dependencies:

```bash
pnpm install
```

Start the API and web client:

```bash
pnpm dev
```

Open <http://localhost:41812>. By default, the server starts with this
repository selected. To start with another repository, provide its absolute
path:

```bash
BYCONVO_REPO=/path/to/repository pnpm dev
```

For the Electron app during development, run:

```bash
pnpm dev:desktop
```

## Common commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Run the embedded API server and SPA in watch mode |
| `pnpm dev:desktop` | Run the SPA and Electron shell for desktop development |
| `pnpm build` | Build every workspace package |
| `pnpm typecheck` | Type-check every workspace package |
| `pnpm lint` | Lint packages that provide a lint script |
| `pnpm format:check` | Check formatting across the workspace |
| `pnpm -r --if-present test` | Run all package test suites |
| `pnpm pack:desktop` | Create an unpacked desktop build locally |
| `pnpm dist:desktop` | Create a distributable desktop build |

## Repository structure

| Package | Responsibility |
| --- | --- |
| `packages/core` | Infrastructure-independent schemas, services, and ports |
| `packages/embedded-server` | Local Effect API, SQLite persistence, Git integration, and agent processes |
| `packages/spa` | React and TanStack Start user interface |
| `packages/desktop` | Electron shell and desktop packaging |
| `packages/feature-flags` | Shared feature switches |
| `packages/lint` | Shared ESLint and Prettier configuration |

The web client runs on port `41812` and proxies `/api` requests to the embedded
server on port `41811`. You can override the selected repository and server
configuration with these environment variables:

| Variable | Description |
| --- | --- |
| `BYCONVO_REPO` | Repository selected when the server starts |
| `BYCONVO_PORT` | Embedded server port (defaults to `41811`) |
| `BYCONVO_SERVER_URL` | API origin used by the Vite development proxy |
| `BYCONVO_DB` | SQLite database path (defaults to `~/.byconvo/byconvo.db`) |

API documentation is available while the server is running at
<http://localhost:41811/api/reference>.

## Releases

Desktop releases use separate beta and production channels. See
[RELEASING.md](./RELEASING.md) for the versioning, signing, and publishing
process.
