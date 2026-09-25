# Reviewer

Mac app for understanding, editing and reviewing code manually or with agents.

![Reviewer — the editor, with a symbol search across the workspace](docs/screenshot.webp)

The native shell lives in `packages/mac-os`; `pnpm dev` runs the API server
and the SPA it hosts, `pnpm dev:mac` builds and opens the app.

## Resolving review comments with an agent

Comments you leave in Reviewer can be handed to any coding agent (Claude Code,
Codex, Cursor, OpenCode, …) through the
[`resolve-reviewer-comments`](skills/resolve-reviewer-comments/SKILL.md) skill.
It reads the comments from the server of the Reviewer window that has the
agent's repository open, implements them and resolves them one by one.

```bash
npx skills add Darna-Digital/reviewer --skill resolve-reviewer-comments
```

Then ask the agent to "resolve my reviewer comments". Needs Node 18+ and
Reviewer running with the repository open.

## Releasing

Releases are built, signed, notarized and published by GitHub Actions when a
version bump lands on `main` — see [RELEASING.md](RELEASING.md).
