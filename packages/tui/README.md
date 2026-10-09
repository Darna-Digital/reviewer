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
| `--pr <number>`   | Review a GitHub pull request                              |
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

### File icons

Files wear type icons in the tree, tabs, diff headers, palette, history and
usages, which need a [Nerd Font](https://www.nerdfonts.com) (3.0 or later) in
the terminal. Turn them off with **show / hide file icons** in the command
palette.

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
- **File icons** are picked by the Mac tree's rules and painted in its hues
  (`render/fileIconRules.generated.ts`, from `bun scripts/importFileIcons.ts`).
- **The server**: started when it is not running (see above).
- **Pull requests** come through the server's GitHub API, as on the Mac app's
  Merge requests: the open list, each one's diff, overview and checks, and its
  review threads (filed under `pr-<number>`). Commenting, replying, resolving
  a thread, deleting a comment, merging and closing happen on GitHub; checking
  one out fetches `refs/pull/<n>/head` here. Requests name this repository
  (`?repo=`), so it works whatever project the Mac app has open.

## Layout

It is the Mac app's IDE, in a terminal:

- **Sidebar** — at its head the surface tabs, Browse · Review · Search
  (Search opens text search in the palette), so the editor beside it keeps
  the full height. Under them the branch chip (with ↑ahead ↓behind) and the compare chip,
  each opening a popover under it: the branch picker (Recent / Local /
  Remote; `⏎` checks out, `→` (or right-click) opens every branch action
  beside it and `←` comes back,
  `+ New branch…`) and the comparison picker. Then the project tree (Browse)
  or the changed files (Review) with the **commit box** under them: tick
  files, write or ✦ generate the message, Commit or Commit & push.
- **Editor** — open-file tabs and the viewer (Browse), or the diff with its
  file stats and view toggles — changed hunks or full files (`E`), unified
  or split (Review). Comments work in both. Wrap (`W` or `⌥Z`, or
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

## Symbols

Go to definition, find usages, hover info and a file's outline come from the
Reviewer server's language providers — the ones the Mac app uses (TypeScript
in-process; Ruby, PHP and Swift language servers). They answer for the
working tree: any line of a file in Browse or the usages preview, and the new
side of uncommitted or branch diffs.

- **Hover** a symbol for its signature and docs.
- **Right-click** a symbol: Go to definition · Find usages · Show info ·
  Comment · Copy. ⌘-click goes straight to the definition, as on the Mac;
  mouse reports carry no ⌘, so it is read off the kitty keyboard protocol's
  own ⌘ events (Ghostty, kitty, WezTerm). ⌥- or ⌃-click does the same in any
  terminal.
- **The keyboard, vim-style** (diff and file view): `w` / `b` move a word
  cursor over the symbols, across lines; `0` / `$` the line's first / last;
  `*` / `#` the next / previous line using it. Then `⏎` (or `⌃]`) goes to its
  definition, `K` shows its info, `u` finds its usages. In a file, `{` / `}`
  step through its definitions (by the outline, or blank lines without one).
  `⌃O` or `⌥←` returns from any jump — definition, usage, symbol, file —
  and `⌥→` goes forward again.
- **`.`** on a line lists its symbols: `⏎` definition, `⌃U` usages, `→` the
  full menu.
- **`@`** lists the symbols in the open file to jump to one.
- **Usages** (`⌥⌘6`, bottom pane): the symbol's usages by category and file,
  beside a preview of the selected one scrolled to its line; `j`/`k` move,
  `⏎` opens, `r` searches again. Drag the rule between them to resize.

A definition that is only the symbol itself opens its usages instead; more
than one opens a picker. The server is asked about this repository whatever
project it has open (`?repo=`); an older server is only asked when its open
project is this one.

## Keys

The Mac app's shortcuts, where the terminal passes ⌘ through — that needs the
kitty keyboard protocol (Ghostty, kitty, WezTerm, iTerm2 with CSI u) and ⌘
not bound by the terminal itself. Each has a ⌃ or plain-key twin for
terminals that keep ⌘, and the vim keys (`j` `k` `g` `G` `]` `[` …) stay.
Digits are vim counts — `10k` moves ten up — so the surfaces and panes have
no plain-digit keys; a lone `0` still goes to the line's first symbol.
`?` lists every key; the status bar shows the ones that work in yours.

| Mac       | Also            | Does                                               |
| --------- | --------------- | -------------------------------------------------- |
| `⌘E`      | `⌃K` `:`        | Command palette                                    |
| `⇧⌘O`     | `⌃⇧O` `⌃P` `p`  | Go to file                                         |
| `⇧⌘F`     | `⌃⇧F` `/`       | Search in files                                    |
| `⌥⌘1` `2` |                 | Browse · Review                                    |
| `⌘G`      |                 | Switch Browse ⇄ Review                             |
| `⌥⌘4`     |                 | Switch branch (popover)                            |
| `⌥⌘5` `7` |                 | History · Run                                      |
| `⌘B`      | `⌃B`            | Bottom pane                                        |
| `⌃⌘S`     | `\`             | Sidebar                                            |
| `⌘R`      | `⌃R` `r`        | Refresh                                            |
| `⌘,`      | `⌃,` `⌃T`       | Theme & appearance                                 |
|           | `E`             | Changed hunks ⇄ full files                         |
| `⇧⌘]` `[` | `]` `[`         | Next · previous tab                                |
| `⌘W`      | `⌃W`            | Close tab                                          |
| `⌘⏎`      | `⌃S`            | Commit (in the message box)                        |
|           | `tab`           | Sidebar → editor → bottom pane                     |
|           | `t` · `T`       | Compare against… · uncommitted ⇄ last branch       |
|           | `c` `e` `x`     | Comment on a line · edit · delete                  |
|           | `space` `i`     | Commit box: include file · message                 |
|           | `esc`           | Back from a commit                                 |
|           | `^o`            | Stop typing into a service                         |
|           | `w` `b` `0` `$` | Word cursor: next · previous · first · last symbol |
|           | `*` `#`         | Next · previous use of the symbol                  |
|           | `⏎` `K` `u`     | Definition · info · usages of the symbol           |
|           | `{` `}`         | Previous · next definition in the file             |
|           | `⌃O` `⌥←` `⌥→`  | Back · back · forward through jumps                |
|           | `W` `⌥Z`        | Wrap long lines                                    |
|           | `q`             | Quit                                               |

## Every key

What a key does depends on where the focus is — `tab` / `⇧tab` moves it
sidebar → editor → bottom pane — and a pane's own keys win over the ones that
work anywhere (`r` searches the usages again, rather than refreshing). A
number typed first repeats a move: `10j`. The ⌘ chords need a terminal that
passes ⌘ through (see Keys).

### Anywhere

| Key                  | Does                            |
| -------------------- | ------------------------------- |
| `?`                  | The keys for where you are      |
| `⌘E` `⌃K` `:`        | Command palette                 |
| `⇧⌘O` `⌃⇧O` `⌃P` `p` | Go to file                      |
| `⇧⌘F` `⌃⇧F` `/`      | Search in files                 |
| `@`                  | Go to a symbol in the open file |
| `m`                  | All comments                    |
| `tab` `⇧tab`         | Next · previous pane            |
| `⌃O` `⌥←`            | Back to where you jumped from   |
| `⌥→`                 | Forward again                   |
| `⌥⌘1` `⌥⌘2`          | Browse · Review                 |
| `⌘G`                 | Switch Browse ⇄ Review          |
| `⌥⌘4`                | Switch branch                   |
| `⌥⌘5` `⌥⌘6` `⌥⌘7`    | History · Usages · Run pane     |
| `⌥⌘8`                | Pull request pane               |
| `M` `⌥⌘3`            | Pull requests (sidebar)         |
| `⌘B` `⌃B`            | Show / hide the bottom pane     |
| `⌃⌘S` `\`            | Show / hide the sidebar         |
| `t`                  | Compare against…                |
| `T`                  | Uncommitted ⇄ last branch       |
| `s`                  | Split ⇄ unified diff            |
| `E`                  | Changed hunks ⇄ full files      |
| `W` `⌥Z`             | Wrap long lines                 |
| `C`                  | Show / hide comments            |
| `F` `L` `P`          | Fetch · pull · push             |
| `⌘R` `⌃R` `r`        | Refresh                         |
| `⌘,` `⌃,` `⌃T`       | Theme & appearance              |
| `q` `⌃C`             | Quit                            |

Create branch, add a service, start / stop all services, commit and push,
cycle the appearance and show / hide file icons have no key; they are in the
command palette.

### Sidebar

| Key                     | Does                               |
| ----------------------- | ---------------------------------- |
| `j` `k` `↓` `↑`         | Next · previous row                |
| `⌃D` `⌃U` `pgdn` `pgup` | Ten down · ten up                  |
| `g` `G` `home` `end`    | First · last                       |
| `⏎` `l` `→`             | Open the file / expand the folder  |
| `h` `←`                 | Collapse / go to the parent        |
| `f`                     | Filter the changed files (Review)  |
| `x`                     | Discard changes…                   |
| `y`                     | Copy the path                      |
| `H`                     | The file's history                 |
| `space`                 | Commit box: include / leave out    |
| `A`                     | Commit box: include all / none     |
| `i`                     | Commit box: write the message      |
| `⌃G`                    | Commit box: ✦ generate the message |
| `⌘⏎` `⌃S`               | Commit box: commit                 |

While writing the message, `⌘⏎` / `⌃S` commits, `⌃G` generates and `esc`
stops typing. In a filter field `⏎` or `esc` stops typing.

### Diff & file

| Key                  | Does                              |
| -------------------- | --------------------------------- |
| `j` `k` `↓` `↑`      | Next · previous line              |
| `⌃D` `pgdn` `space`  | Half a page down                  |
| `⌃U` `pgup`          | Half a page up                    |
| `g` `G` `home` `end` | Top · bottom                      |
| `←` `→`              | Scroll sideways (wrap off)        |
| `w` `b`              | Next · previous symbol            |
| `0` `$`              | First · last symbol on the line   |
| `*` `#`              | Next · previous use of the symbol |
| `⏎` `⌃]`             | Go to definition                  |
| `K`                  | Symbol info                       |
| `u`                  | Find usages                       |
| `.`                  | Symbols on this line…             |
| `c`                  | Comment on the line               |
| `n` `N`              | Next · previous comment           |
| `e` `⏎`              | Edit the comment (on a comment)   |
| `x`                  | Delete the comment (on a comment) |
| `r`                  | Reply on GitHub (on a PR comment) |
| `R`                  | Resolve · reopen its thread       |

In the diff (Review):

| Key     | Does                                                 |
| ------- | ---------------------------------------------------- |
| `]` `[` | Next · previous file                                 |
| `}` `{` | Next · previous paragraph (or hunk)                  |
| `h` `l` | Old · new side (split; `←` `→` too while wrap is on) |
| `z`     | Fold the file                                        |
| `⏎`     | Fold the file (on its header)                        |
| `esc`   | Back from a commit or pull request                   |

In a file (Browse):

| Key                 | Does                                      |
| ------------------- | ----------------------------------------- |
| `}` `{`             | Next · previous definition (or paragraph) |
| `⇧⌘]` `⇧⌘[` `]` `[` | Next · previous tab                       |
| `⌘W` `⌃W`           | Close the tab                             |

### Bottom pane

| Pane    | Key             | Does                          |
| ------- | --------------- | ----------------------------- |
| Usages  | `j` `k` `↓` `↑` | Next · previous usage         |
|         | `⏎`             | Open the usage                |
|         | `r`             | Search again                  |
| History | `j` `k` `↓` `↑` | Older · newer commit          |
|         | `⏎`             | Show the commit               |
|         | `a`             | All branches ⇄ HEAD           |
|         | `f`             | Filter by text or hash        |
|         | `esc`           | Clear the filters             |
|         | `y`             | Copy the hash                 |
| Run     | `j` `k` `↓` `↑` | Next · previous service       |
|         | `←` `→`         | Scroll the commands sideways  |
|         | `⏎` `space`     | Start / stop                  |
|         | `R`             | Restart                       |
|         | `a` `+`         | Add a service…                |
|         | `d` `-`         | Remove the service…           |
|         | `A` `X`         | Start all · stop all          |
|         | `i`             | Type into its output          |
|         | `⌃O`            | Stop typing into it           |
| Pull    | `j` `k` `↓` `↑` | Scroll the overview           |
| request | `⏎`             | Review the diff               |
|         | `c`             | Check out                     |
|         | `m`             | Merge… (method, then confirm) |
|         | `x`             | Close…                        |
|         | `o`             | Open on GitHub                |
|         | `y` `Y`         | Copy the link · branch name   |
|         | `r`             | Reload from GitHub            |

The **⇅ PRs** tab (`M`) lists the open pull requests in the sidebar, by
target branch, with their CI mark and age. `j` `k` open each in turn (the diff
follows), `⏎` moves to its diff, `f` `/` searches number, title, author and
branch, and `c` `m` `x` `o` `y` `Y` `r` act on it as in the pane. Under the
list sits the file tree of the pull request under review, keys as the Review
tree; `tab` moves from the list to its files and on to the diff. The same list
opens as a popover from the compare chip (`t`) or when the sidebar is hidden:
`⏎` reviews, `⌃X` checks out, `⌃G` opens on GitHub, `⌃R` reloads.

### Popovers

| In                      | Key                     | Does                               |
| ----------------------- | ----------------------- | ---------------------------------- |
| Palette and pickers     | `↓` `↑` `⌃N` `⌃P`       | Next · previous                    |
|                         | `pgdn` `pgup`           | Ten down · ten up                  |
|                         | `⏎`                     | Pick                               |
|                         | `esc`                   | Close                              |
| Palette                 | `home` `end`            | First · last                       |
|                         | `⌫` (empty field)       | Up a level                         |
|                         | `⌘E` `⌃K`               | Back to Commands (closes it there) |
|                         | `⌥C` `⌥W` `⌥R`          | Search: case · whole word · regex  |
| Branch picker           | `→` `tab`               | The branch's actions               |
| Compare picker          | `⌃R`                    | Remember as the branch's target    |
| Theme picker            | `tab`                   | Cycle System · Light · Dark        |
| Symbols on a line (`.`) | `⏎`                     | Go to definition                   |
|                         | `⌃U`                    | Find usages                        |
|                         | `→`                     | Every action for the symbol        |
| Menus                   | `j` `k` `↓` `↑`         | Next · previous                    |
|                         | `⏎` `→`                 | Run                                |
|                         | `←`                     | Back to the menu it opened from    |
|                         | `esc`                   | Close                              |
| Comment                 | `⏎`                     | Save                               |
|                         | `⇧⏎` `⌥⏎`               | New line                           |
|                         | `esc`                   | Cancel                             |
| Forms                   | `tab` `↓` · `⇧tab` `↑`  | Next · previous field              |
|                         | `⏎` · `esc`             | Submit · cancel                    |
| Confirm                 | `y` `⏎` · `n` `esc` `q` | Yes · no                           |
| Hover card              | any key                 | Hide it (`esc` does nothing else)  |

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
