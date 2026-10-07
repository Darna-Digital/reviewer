# @reviewer/tui

Reviewer in a terminal: the change you are reviewing, the branches you could
read it against, the history to pick a commit from, and inline comments —
drawn with [OpenTUI](https://opentui.com) and run on Bun.

```bash
pnpm tui                     # the repository you run it from
bun packages/tui/src/main.tsx ~/code/app --against main
```

| Option            | Does                                                    |
| ----------------- | ------------------------------------------------------- |
| `[path]`          | Any path inside the repository (default: here)          |
| `--against <ref>` | Read the branch against `<ref>`'s merge base            |
| `--commit <sha>`  | Read one commit                                         |
| `--theme <name>`  | Any theme in Reviewer's catalog (`--themes` lists them) |
| `--light`         | The light default theme                                 |

### Install

```bash
pnpm install:tui             # builds dist/reviewer-tui and puts it in ~/.local/bin
reviewer-tui                 # then, in any repository
```

The build is one self-contained binary (`bun build --compile`): Bun, the
OpenTUI native library and the syntax grammars are all inside it, so it runs
with no checkout and no Bun installed. `BIN_DIR=/somewhere pnpm install:tui`
installs it elsewhere; run the same command again to update it.

With no option it opens where the Mac app would: the branch against the
target recorded for it, or the uncommitted work.

## Shared with the app

- **Comments** are read from and written to `~/.reviewer/reviewer.db` — the
  embedded server's own database, schema and document shape — under the same
  target keys (`worktree`, `branch-<ref>`, `commit-<sha>`). A note left here
  shows in the Mac app's diff and the reverse, and the
  `resolve-reviewer-comments` skill finds both. `REVIEWER_DB` points it at
  another file.
- **Diffs** are read the way the server reads them: the working tree with its
  untracked files, a branch from its merge base through to the working tree.
- **Colours** come from core's theme catalog and highlighter, so code is
  coloured exactly as in the app.

## Layout

It is the Mac app's IDE, in a terminal:

- **Top rail** — the project, Browse / Review, Fetch · Pull · Push, the
  command palette.
- **App rail** (left) — Browse `1`, Review `2`, Search `/`; then the bottom
  pane's tabs: Branches `4`, History `5`, Terminal `6`, Run `7`.
- **Sidebar** — the branch and compare chips, then the project tree (Browse)
  or the changed files (Review) with the **commit box** under them: tick
  files, write or ✦ generate the message, Commit or Commit & push.
- **Editor** — open-file tabs and the viewer (Browse), or the diff with its
  comparison and view toggles (Review). Comments work in both.
- **Bottom pane** — Branches (Recent / Local / Remote and every branch
  action), History (graph, filters, commit details), Terminal (real shells),
  Run (the repository's services with live output).
- **Bottom rail** — mode, live keys, each service's status, the branch.

Services are the Mac app's Run commands, shared through the database; the TUI
runs its own processes and stops them when it quits.

## Keys

`?` lists every key; `^k` (or `:`) finds any command by name.

| Key              | Does                                              |
| ---------------- | ------------------------------------------------- |
| `tab`            | Sidebar → editor → bottom pane                    |
| `1` `2`          | Browse · Review                                   |
| `4` `5` `6` `7`  | Branches · History · Terminal · Run               |
| `^b` · `\`       | Bottom pane · sidebar                             |
| `p` · `/`        | Go to file · search in files                      |
| `t` · `T`        | Compare against… · flip uncommitted ⇄ last branch |
| `c` `e` `x`      | Comment on a line · edit · delete                 |
| `space` `i` `^s` | Commit box: include file · message · commit       |
| `^o`             | Leave a terminal you are typing into              |
| `q`              | Quit                                              |

## Mouse

Click selects, double-click opens, right-click gives a context menu (tree
rows, branches, commits, services). The wheel scrolls everything; drag the
sidebar's edge or the bottom pane's header to resize. Every rail icon, tab,
chip and button is clickable.

## Development

```bash
bun test                       # parser, layout and store
pnpm typecheck
bun scripts/snapshot.tsx --input "3 j enter click:40,0" --out /tmp/frame.html
```

| Folder        | Holds                                                             |
| ------------- | ----------------------------------------------------------------- |
| `diff/`       | Parsing, inline changes, layout, highlighting — pure              |
| `git/`        | One module per git concern: `exec`, `repo`, `diff`, `refs`, `log` |
| `store/`      | The shared SQLite store                                           |
| `render/`     | Painting rows into styled segments — pure                         |
| `app/`        | Hooks, the command table (`commands.ts`) and `App`                |
| `components/` | One component per piece of the screen                             |

Every key, its help text, its status-bar hint and its palette entry live in
one table, `app/commands.ts`.

`scripts/snapshot.tsx` renders the app headlessly with OpenTUI's test
renderer, plays the given keys and mouse events, and writes the frame as coloured HTML — a
way to see a layout change without a terminal.
