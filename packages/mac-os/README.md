# @reviewer/mac-os

A native macOS shell for Reviewer, written in SwiftUI. Same embedded API
server as the Electron desktop app; the window, sidebar, bottom pane and menu
bar are AppKit's own, and the web app's surfaces are hosted inside it as
**islands** — each one a web view of its own, set in the native layout,
showing one part of the SPA.

What it does today:

- **Native sidebar** — the system's own sidebar, the full-height column of
  glass running up to the window's top edge with the traffic lights, the
  project picker and the sidebar toggle inside it — the toggle as Music has
  it, the picker beside it as Notes has its folder button — and the
  rail down its leading edge, holding the code page's file
  tree as a native outline in the web sidebar's two layouts:
  the project's files while browsing, and on a diff the changed files under
  a search, badged and tinted by git status, with the commit composer under
  them while the changes are your own — and across from the branch picker,
  at the header's other edge, what those changes are read against: the web
  header's compare picker (uncommitted only, or the merge base with a
  branch), stood in the sidebar since that is where the shell keeps the
  commit view's controls. The rows wear @pierre/trees' own
  file-type icons, imported at build time (`scripts/import-file-icons.mjs`).
  Picking a file sends the code island to it; a file the island opens on its
  own highlights here; the context menu is the web tree's — history, copy
  path, reveal, new, rename, discard, delete. On the merge-requests surface
  the same pane holds the project's open pull requests instead, read by the
  shell itself from the server (`PullRequests` over `/api/github/pulls`,
  re-read whenever the app comes to the front, as the web query refetches
  on focus): every one under the branch it targets, its title over its
  author and branch, what CI said and whether anything blocks it at the
  trailing edge, under the web list's search and its branch-and-time
  filter (`PullRequestList`). Picking one sends the page island to its
  diff and stands the pull request's own column up between the sidebar and
  the diff — two islands, its overview over its files: everything about it
  that is not its diff, drawn natively (`PullRequestOverview`) — title,
  byline, branches, size, the checks and why a merge is blocked, who is on
  it, its description as markdown — with merge (confirmed, any of GitHub's
  three ways), check out, close (confirmed) and the link out to GitHub;
  and under it the files it touches, the same native outline under the
  changed-files search (`PullRequestColumn`). The row stays picked while
  the page is on it, so the list is the way between pull requests, as
  Mail's is between messages. On the sessions surface the
  same pane holds the agent sessions instead — every project's, newest
  first, with the web list's marks on each row and the cloud runs grouped
  above — drawn natively from what the page reports (`SessionsList`), under
  the web rail's search and filter menu (the project, how far back), both
  of them the page's own server query. Picking one sends the page island to
  that conversation on the Sessions tab; the context menu lifts it into a
  tab of its own or deletes it, and the foot of the list fetches the next
  page.
- **Islands** — beside the sidebar the window is laid out as rounded
  panels standing a few points apart on the web app's frame colour: the
  page island and the bottom pane, with a seam between them that resizes
  the pane; the sidebar's own edge resizes it, and its toggle or ⌃⌘S puts
  it away, when the rail moves out onto the frame beside the page. The toolbar and the
  rail are the bare window around them.
- **Window tabs** — the web app's own strip, drawn natively on the toolbar:
  Code and Sessions pinned, then one per agent session (⌘T mints one;
  ⌘W closes, ⌘1–9 jump to a session, ⌘⇧] / ⌘⇧[ step along the strip). The
  strip lives in the page island — switching is a route change inside it,
  every tab's page primed while the window is idle, as in Electron — and
  sends the toolbar a picture of itself; a tab pressed there, and each menu
  chord, goes back down to the strip to answer.
- **Launchpad** (⌘L) — every tab as a card wearing the last picture taken
  of it. As in the web app, it slides out from under the toolbar — across
  the whole window, one grid on the bare frame — and pushes everything
  under the bar down by its own height rather than covering it: the
  sidebar's pane of glass along with the islands, moved, not resized, so
  the web view and the terminal are composited down instead of laid out
  again — with what it pushed dimmed under it and a collapse tab on its
  edge. That edge is a seam: pull it down from the top of the page to draw
  the panel out under the pointer, pull it up to shrink it, and far enough
  to put it away. The trackpad does the same on the toolbar — two fingers
  drawn down it pull the panel out live, and three fingers pull it the same
  way — read off the trackpad's own touches, since the system makes no
  event of a vertical three-finger swipe — and let go of, fling it the rest
  of the way open or shut (`LaunchpadGestureMonitor`; three vertical
  fingers are free for the app only while Mission Control and App Exposé
  are on four fingers in System Settings).
- **Page island** — the SPA's routed page, with the window's own chrome and
  file tree off: the diff, the file view, review comments, edit mode, a
  pull request's diff alone — its overview, its files and the list of them
  being the shell's — the sessions surface, with its open-file strip along its
  top and, on a diff, the web header's horizontal-or-vertical layout toggle
  at the end of the same band. The one drawer it keeps under the page is
  find usages, which is opened from a symbol in the page's own code; it
  takes the foot of the window from the bottom pane while it is up, and is
  put away when the pane takes it back.
- **Bottom pane** (⌘B) — the web app's dock, drawn natively: a bar with a
  segmented switch between its four surfaces, in the web strip's order,
  laid out like Xcode's debug area — a bar along the top, a list, a detail
  column. Branches is the web branches dock: a search over every branch,
  then Recent, Local folded by folder and Remote folded by remote, the
  branch you are on starred and the others carrying their distance from
  upstream, each root of a multi-root project under a header of its own;
  a double-click checks out, the context menu is the switcher's, and the
  empty space under the rows has the surface's own — new branch, update,
  push. History is the web history dock: the filter bar — the branch the
  log follows, or the root it is narrowed to; the file it is narrowed to;
  a text or hash with the regex and case toggles; an author; a date to
  start from — over the commits, each row its lane in the graph, its
  refs, its subject, its author and its date, paged in as the list nears
  its end (`/api/log`, or `/api/project/log` merged across a multi-root
  project). A commit picked opens on the page and stands beside the list
  in full — subject, body, sha, author, date, refs, and the files it
  touched as a tree wearing the @pierre/trees icons, a file picked opening
  the commit's diff on it. "Show History" — the tree's menu, the page's
  path bar — lands here narrowed to that file. Terminal is the project's
  terminal sessions (SwiftTerm over the server's PTY sockets): a filtered
  list with open and close in its footer, and the selected shell under a
  bar that names it and its branch and renames it in place. Run is the
  project's dev commands: a status dot and a run/stop mark on each row,
  add, remove, start-all and stop-all in the footer, and the selected
  command's output under a bar with its command line, its state and
  play/stop/restart.
- **Search** — the web app's palette as a Liquid Glass pane over the page:
  ⇧⇧ or ⌘⇧O finds a file by name (the same fuzzy match, capped the same),
  ⌘⇧F greps the working tree through the server (`/api/search`, or the
  project-wide one for a multi-root project) with the case, whole-word and
  regex toggles, opening on whatever the page has selected. A result opens
  in the page island where the web palette would open it — in place on a
  code surface, otherwise on the diff.
- **Projects** — the chip at the head of the sidebar, the open project's
  avatar and name, pulls down the recents the server remembers, the open
  one ticked; ⌘O, or its last row, opens any other folder through
  `NSOpenPanel`.

## Islands

An island is the SPA loaded with `window.reviewer.island` set — the bridge the
shell installs before the first script runs (`IslandHost`). The app's `_app`
layout then renders `IslandLayout` instead of `AppLayout`: the routed page with
no frame, rail, header or dock around it, since those are the window's. Same
routes and URLs, so the shell steers an island with the hrefs the app already
uses. The contract is small and lives in `packages/spa/src/lib/shell.ts`:

- shell → island: `navigate(href)`, `refresh`, `windowTabs(action)`,
  `tree(action)`, `sessions(action)`, `dock(close)`
- island → shell: `ready`, `navigated(href)`, `windowTabs(strip)`,
  `tree(listing)`, `treeState(selection, commit composer)`, `sessions(list)`,
  `dock(shown)`, `history(path)`

The tree and sessions pairs are the chrome the code island reports for the
shell to draw natively in its sidebar: the file tree on the code pages
(`FileTreeOutline`, over `SidebarTree`) — beside the sidebar rather than in
it while the page is on a pull request, whose files stand under its
overview — and the sessions list on the sessions
surface (`SessionsList`, over `ShellSessions`). The merge requests cross no
bridge: the shell reads them from the server itself (`PullRequests`) and
steers the island to a pull request's address when one is picked; the
island's own overview and file columns stand down there, and its list page
is only the room the diff will take. The shell sends every click
back as an action for the page to apply to its own store, its file actions,
its git actions or its chat actions, having already asked what the web tree
asks first — a yes to a deletion, a name for a new file. The window-tabs pair runs the other way round: the strip is the
island's, and what crosses is a picture of it for the Tabs menu to name, and
the chords the menu bar claims (`WindowTabAction`) for the strip to answer.

Islands cannot share a JavaScript heap, so whatever two of them both need —
the project, where the code surface points — lives in `AppModel`, and the
shell is the one that navigates between them. A native control reaching for a
code surface — the rail, a search result, a commit in the history — sends the
page island to that address, and the strip hands the window to the Code tab
as the page arrives, the way it does for a link. The dock pair is the
find-usages drawer the code island keeps under its page: the island says
when it is up, so the native pane leaves the foot of the window to it, and
the pane puts it away when it takes the foot back. `history(path)` runs the
other way: the page's own "Show history" — its path bar, a file's tab —
asks the shell, whose History surface answers. One island is hosted today:
the page (`code`).

Where the documents come from is `SpaSource`: a debug build takes the Vite
dev server on `:41812` (HMR inside the native window); a release build takes
the SPA build bundled into `Contents/Resources/spa` by `scripts/bundle.sh`,
served over `reviewer://app` like the Electron shell does. `REVIEWER_SPA_URL`
overrides either — an http origin, or a `file://` directory holding a build.

## Running

```bash
pnpm --filter @reviewer/mac-os dev
```

For the code island, also have the SPA dev server up (`pnpm dev` at the root
runs it with the API server).

That builds with SwiftPM, wraps the binary in `.build/Reviewer.app` (see
`scripts/bundle.sh`) and opens it. `pnpm --filter @reviewer/mac-os start` runs
the bare binary via `swift run` instead — fine for iterating, but without a
bundle there is no dock icon.

To iterate on the Swift side without leaving the editor:

```bash
pnpm --filter @reviewer/mac-os watch
```

Same debug build and bundle, but the tab stays: every save under `Sources/`
or `Resources/` rebuilds and replaces the running app (`scripts/watch.sh`).
A build that fails prints its errors and leaves the old app up until the next
save. The project comes back on relaunch because it is the server's, not the
window's. This is what the cmux "reviewer: start" workspace runs in its
mac-os tab.

The app looks for the API server on `127.0.0.1:41811` (`REVIEWER_PORT` to
change it). If nothing answers it spawns one from the repository root with
`pnpm --filter @reviewer/embedded-server start`, exactly like the Electron dev
path, and stops it again on quit. A server already running — `pnpm dev`, or
the desktop app — is reused as is.

Requires Xcode 16+ (Swift 6 language mode) and macOS 15.

## Layout

```
Sources/Reviewer/
  ReviewerApp.swift      @main, menu commands, app delegate
  Server/ServerLauncher  reachability check + spawn of the embedded server
  Api/                   Codable mirrors of the core schemas, HTTP client, chat socket
  State/                 AppModel, WindowTab, BottomPaneTab, DockSurface, CommitHistory, CommitGraph, FileTree, SidebarTree, SidebarSessions, PullRequests, QuickSearch (+ the ⇧⇧ monitor)
  FileIcons/             FileIcon (resolver + rasteriser) over the generated @pierre/trees sprite
  Islands/               IslandHost (web view + bridge), SpaSource, SpaSchemeHandler, IslandView
  Terminal/              TerminalSession — the shell behind the Terminal surface
  Services/              DevServices + DevProcessStream — dev commands and their output
  Views/                 ContentView (split view), Sidebar, PullRequests (list, overview, column), Tabs, BottomPane, Search, Launchpad, Welcome
```

Not here yet: native menus for the islands' popovers, drag and drop between
the sidebar and the islands, more than one terminal.
