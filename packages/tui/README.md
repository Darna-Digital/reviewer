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

## Keys

`?` shows them all.

| Key             | Does                                         |
| --------------- | -------------------------------------------- |
| `1` `2` `3` `4` | Files · branches · history · comments        |
| `tab`           | Move between the sidebar and the diff        |
| `j` `k`         | Move by line (or by item in a list)          |
| `]` `[` `}` `{` | Next/previous file, next/previous hunk       |
| `c`             | Comment on the line; `e` edits, `x` deletes  |
| `t`             | Pick what to compare against                 |
| `T`             | Flip between uncommitted and the last branch |
| `m`             | Branches tab: make it the branch's target    |
| `p`             | Jump to a file                               |
| `s` · `w`       | Split/unified · wrap long lines              |
| `q`             | Quit                                         |

## Mouse

Click selects, double-click opens (a branch is compared, a commit shown, a
comment jumped to) — on a diff line it starts a comment, on a card it edits
it. The wheel scrolls everything, the divider drags to resize the sidebar, and
the header's `⇄` chip, the tabs, and the status bar's hints and toggles are
all buttons.

## Picking a target

`t` (or the header chip) lists the likely targets first — the branch's saved
target, the default branch, its upstream, recent picks — with how far HEAD is
ahead/behind each, then every local and remote branch. Tick **remember**
(`^r`) to save the pick as the branch's target: it is written to the same
`branch_target` table the Mac app reads, so both open on it next time.

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

Every key, its help text and its status-bar hint live in one table,
`app/commands.ts`.

`scripts/snapshot.tsx` renders the app headlessly with OpenTUI's test
renderer, plays the given keys and mouse events, and writes the frame as coloured HTML — a
way to see a layout change without a terminal.
