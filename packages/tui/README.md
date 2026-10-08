# @reviewer/tui

Reviewer in a terminal: the change you are reviewing, the branches you could
read it against, the history to pick a commit from, and inline comments —
drawn with [OpenTUI](https://opentui.com) and run on Bun.

```bash
pnpm tui                     # the repository you run it from
bun packages/tui/src/main.tsx ~/code/app --against main
```

| Option            | Does                                                      |
| ----------------- | --------------------------------------------------------- |
| `[path]`          | Any path inside the repository (default: here)            |
| `--against <ref>` | Read the branch against `<ref>`'s merge base              |
| `--commit <sha>`  | Read one commit                                           |
| `--theme <name>`  | This run only: `terminal` or a catalog theme (`--themes`) |
| `--light`         | This run only: the light default theme                    |
| `--no-server`     | Leave the Reviewer server alone                           |

### Install

```bash
pnpm install:tui             # builds dist/reviewer and puts it in ~/.local/bin
reviewer                     # then, in any repository
```

The build is one self-contained binary (`bun build --compile`): Bun, the
OpenTUI native library and the syntax grammars are all inside it, so it runs
with no checkout and no Bun installed. `BIN_DIR=/somewhere pnpm install:tui`
installs it elsewhere; run the same command again to update it.

With no option it opens where the Mac app would: the branch against the
target recorded for it, or the uncommitted work.

### The Reviewer server

On launch it checks for the Reviewer server on `127.0.0.1:41811`
(`REVIEWER_PORT`) the way the Mac app does, and starts it when nothing
answers: from the Reviewer checkout the binary was built from, else from
`/Applications/Reviewer.app`. It is started detached through a login shell
and left running when the TUI quits — the Mac app and the
`resolve-reviewer-comments` skill share it. Its output goes to
`~/.reviewer/server.log`.

### Theme

By default it draws on the terminal's own background (transparent) and takes
its foreground and ANSI colours; code keeps Reviewer's highlighting for the
terminal's light or dark scheme. `⌘,` (or `⌃T`) opens the theme picker:
moving through it previews each theme live, `tab` cycles the appearance —
**System**, Light, Dark — and a theme is kept for its own scheme, as in the
Mac app's settings (a light theme and a dark theme). With System it follows
the OS appearance as it changes, and terminals that report colour-scheme
changes repaint at once. Saved in `~/.reviewer/tui-settings.json`.

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
- **The server**: started when it is not running (see above).

## Layout

It is the Mac app's IDE, in a terminal:

- **Top rail** — Browse · Review · Search (Search opens text search in the
  palette).
- **Sidebar** — the branch chip (with ↑ahead ↓behind) and the compare chip,
  each opening a popover under it: the branch picker (Recent / Local /
  Remote; `⏎` checks out, `→` (or right-click) opens every branch action
  beside it and `←` comes back,
  `+ New branch…`) and the comparison picker. Then the project tree (Browse)
  or the changed files (Review) with the **commit box** under them: tick
  files, write or ✦ generate the message, Commit or Commit & push.
- **Editor** — open-file tabs and the viewer (Browse), or the diff with its
  file stats and view toggles — changed hunks or full files (`E`), unified
  or split (Review). Comments work in both. Wrap (`w`, or
  the `wrap` toggle in either header) is one setting for both; with it off,
  long lines scroll sideways: `←` `→`, a sideways swipe, or ⇧+wheel (the TUI
  asks the terminal to pass ⇧ through, which Ghostty and xterm honour).
  Either header's `◆ N comments ▾` lists comments by file, each with its
  line of code — this change's first, then every note left on the codebase
  while browsing; picking one jumps to it (opening the file when it is not in
  the diff).
- **Bottom pane** — History (graph, filters, commit details — moving
  through it opens each commit; `esc` or Browse goes back) and Run (the repository's services with live
  output; the commands table scrolls sideways when it overflows).
- **Palette** — the Mac app's: Commands at the root, with Files, Search
  (text in files, with `Aa` case, `ab` whole word and `.*` regex — `⌥c`
  `⌥w` `⌥r`) and Git › Branches under it. A breadcrumb shows where you are;
  `⌫` on an empty field goes back up. Results are grouped by file with the
  match marked, and the Files and Search queries are kept between openings.
- **Comments** open in a popover under the line, lined up with the comment
  cards: `⏎` saves, `⇧⏎` breaks the line, `esc` cancels.
- **Bottom rail** — a notice, or three live keys; then History · Run (with
  how many services are running) and `?`.

Services are the Mac app's Run commands, shared through the database; the TUI
runs its own processes and stops them when it quits.

## Keys

The Mac app's shortcuts, where the terminal passes ⌘ through — that needs the
kitty keyboard protocol (Ghostty, kitty, WezTerm, iTerm2 with CSI u) and ⌘
not bound by the terminal itself. Each has a ⌃ or plain-key twin for
terminals that keep ⌘, and the vim keys (`j` `k` `g` `G` `]` `[` …) stay.
`?` lists every key; the status bar shows the ones that work in yours.

| Mac       | Also           | Does                                         |
| --------- | -------------- | -------------------------------------------- |
| `⌘K`      | `⌃K` `:`       | Command palette                              |
| `⇧⌘O`     | `⌃⇧O` `⌃P` `p` | Go to file                                   |
| `⇧⌘F`     | `⌃⇧F` `/`      | Search in files                              |
| `⌥⌘1` `2` | `1` `2`        | Browse · Review                              |
| `⌥⌘4`     | `4`            | Switch branch (popover)                      |
| `⌥⌘5` `7` | `5` `7`        | History · Run                                |
| `⌘B`      | `⌃B`           | Bottom pane                                  |
| `⌃⌘S`     | `\`            | Sidebar                                      |
| `⌘R`      | `⌃R` `r`       | Refresh                                      |
| `⌘,`      | `⌃,` `⌃T`      | Theme & appearance                           |
|           | `E`            | Changed hunks ⇄ full files                   |
| `⇧⌘]` `[` | `]` `[`        | Next · previous tab                          |
| `⌘W`      | `⌃W`           | Close tab                                    |
| `⌘⏎`      | `⌃S`           | Commit (in the message box)                  |
|           | `tab`          | Sidebar → editor → bottom pane               |
|           | `t` · `T`      | Compare against… · uncommitted ⇄ last branch |
|           | `c` `e` `x`    | Comment on a line · edit · delete            |
|           | `space` `i`    | Commit box: include file · message           |
|           | `esc`          | Back from a commit                           |
|           | `^o`           | Stop typing into a service                   |
|           | `q`            | Quit                                         |

## Mouse

Click selects, double-click opens, right-click gives a context menu (tree
rows, branches, commits, services). The wheel scrolls everything (⇧+wheel or
a sideways swipe scrolls across); drag the rules — the sidebar's edge, the
line above the bottom pane, the one between the history list and its details
— to resize. Every tab, chip and button is clickable.

## Development

```bash
bun test                       # parser, layout and store
pnpm typecheck
bun scripts/snapshot.tsx --input "3 j enter click:40,0" --out /tmp/frame.html
bun scripts/bench.tsx --against v0.0.10  # frame times and event-loop stalls while scrolling
```

Syntax highlighting runs in a worker (`diff/highlightWorker.ts`, bundled as a
second entry point by `build:bin`), so a large file never freezes a frame.

| Folder        | Holds                                                             |
| ------------- | ----------------------------------------------------------------- |
| `diff/`       | Parsing, inline changes, layout, highlighting — pure              |
| `git/`        | One module per git concern: `exec`, `repo`, `diff`, `refs`, `log` |
| `store/`      | The shared SQLite store, and the TUI's layout and settings files  |
| `theme/`      | Terminal colours, OS appearance, resolving the look               |
| `search/`     | The palette's modes and fuzzy matching — pure                     |
| `process/`    | Shells, services, and starting the Reviewer server                |
| `render/`     | Painting rows into styled segments — pure                         |
| `app/`        | Hooks, the command table (`commands.ts`) and `App`                |
| `components/` | One component per piece of the screen                             |

Every key, its help text, its status-bar hint and its palette entry live in
one table, `app/commands.ts`.

`scripts/snapshot.tsx` renders the app headlessly with OpenTUI's test
renderer, plays the given keys and mouse events, and writes the frame as coloured HTML — a
way to see a layout change without a terminal. `--terminal-bg '#1e1e2e'`
stands in for a terminal that reports its colours (the test renderer answers
none); transparent cells are drawn on it.
