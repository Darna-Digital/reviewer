# @reviewer/mac-os

A native macOS shell for Reviewer, written in SwiftUI. Same embedded API
server as the Electron desktop app; the window, sidebar, bottom pane and menu
bar are AppKit's own, and the web app's surfaces are hosted inside it as
**islands** — each one a web view of its own, set in the native layout,
showing one part of the SPA.

What it does today:

- **Native sidebar** — the code page's file tree as a native outline on an
  island floating beside the rail, in the web sidebar's two layouts:
  the project's files while browsing, and on a diff the changed files under
  a search, badged and tinted by git status, with the commit composer under
  them while the changes are your own. The rows wear @pierre/trees' own
  file-type icons, imported at build time (`scripts/import-file-icons.mjs`).
  Picking a file sends the code island to it; a file the island opens on its
  own highlights here; the context menu is the web tree's — history, copy
  path, reveal, new, rename, discard, delete. On the sessions surface the
  same pane holds the agent sessions instead — every project's, newest
  first, with the web list's marks on each row and the cloud runs grouped
  above — drawn natively from what the page reports (`SessionsList`), under
  the web rail's search and filter menu (the project, how far back), both
  of them the page's own server query. Picking one sends the page island to
  that conversation on the Sessions tab; the pointer resting on a row opens
  the web card's preview as a popover — the tail of the conversation, its
  count and project; the context menu lifts it into a tab of its own or
  deletes it, and the foot of the list fetches the next page.
- **Islands** — the window is laid out as rounded panels standing a few
  points apart on the web app's frame colour: the sidebar, the page island
  and the bottom pane, with seams between them that resize the
  sidebar and the pane (⌃⌘S puts the sidebar away). The toolbar and the
  rail are the bare window around them.
- **Window tabs** — the web app's own strip, drawn natively on the toolbar:
  Code and Sessions pinned, then one per agent session (⌘T mints one;
  ⌘W closes, ⌘1–9 jump to a session, ⌘⇧] / ⌘⇧[ step along the strip). The
  strip lives in the page island — switching is a route change inside it,
  every tab's page primed while the window is idle, as in Electron — and
  sends the toolbar a picture of itself; a tab pressed there, and each menu
  chord, goes back down to the strip to answer.
- **Launchpad** (⌘L) — every tab as a card wearing the last picture taken
  of it. As in the web app, it slides out from under the toolbar and pushes
  the islands down by its own height rather than covering them — moved, not
  resized, so the web view and the terminal are composited down instead of
  laid out again — with the page dimmed under it and a collapse tab on its
  edge. That edge is a seam: pull it down from the top of the page to draw
  the panel out under the pointer, pull it up to shrink it, and far enough
  to put it away. The trackpad does the same on the toolbar — two fingers
  drawn down it pull the panel out live, a three-finger swipe down flings
  it open and a swipe up closes it (`LaunchpadGestureMonitor`; vertical
  three-finger swipes only reach the app when Mission Control and App
  Exposé are on four fingers in System Settings).
- **Page island** — the SPA's routed page, with the window's own chrome and
  file tree off: the diff, the file view, review comments, edit mode, the
  merge requests, the sessions surface, with its open-file strip along its
  top — and under it the web app's git dock, as the web layout has it:
  Branches and History as a drawer under the page, or with the window to
  themselves. The rail's foot reaches them the way the web rail does, over
  the bridge, and lights up from what the island reports back; find usages
  is the page's own, opened from a file.
- **Bottom pane** (⌘B) — laid out like Xcode's debug area: a bar with a
  segmented switch between its two native surfaces, then a source list
  beside a detail column. It shares the foot of the window with the dock
  above — one of them up at a time, whichever the rail was last pressed
  for. Terminal is the project's terminal sessions
  (SwiftTerm over the server's PTY sockets): a filtered list with open and
  close in its footer, and the selected shell under a bar that names it and
  its branch and renames it in place. Run is the project's dev commands: a
  status dot and a run/stop mark on each row, add, remove, start-all and
  stop-all in the footer, and the selected command's output under a bar
  with its command line, its state and play/stop/restart.
- **Search** — the web app's palette as a Liquid Glass pane over the page:
  ⇧⇧ or ⌘⇧O finds a file by name (the same fuzzy match, capped the same),
  ⌘⇧F greps the working tree through the server (`/api/search`, or the
  project-wide one for a multi-root project) with the case, whole-word and
  regex toggles, opening on whatever the page has selected. A result opens
  in the page island where the web palette would open it — in place on a
  code surface, otherwise on the diff.
- **Projects** — ⌘O opens a folder through `NSOpenPanel`; recents come from
  the server.

## Islands

An island is the SPA loaded with `window.reviewer.island` set — the bridge the
shell installs before the first script runs (`IslandHost`). The app's `_app`
layout then renders `IslandLayout` instead of `AppLayout`: the routed page with
no frame, rail, header or dock around it, since those are the window's. Same
routes and URLs, so the shell steers an island with the hrefs the app already
uses. The contract is small and lives in `packages/spa/src/lib/shell.ts`:

- shell → island: `navigate(href)`, `refresh`, `windowTabs(action)`,
  `tree(action)`, `sessions(action)`, `dock(action)`
- island → shell: `ready`, `navigated(href)`, `windowTabs(strip)`,
  `tree(listing)`, `treeState(selection, commit composer)`, `sessions(list)`,
  `dock(shown)`

The tree and sessions pairs are the chrome the code island reports for the
shell to draw natively in its sidebar: the file tree on the code pages
(`FileTreeOutline`, over `SidebarTree`) and the sessions list on the sessions
surface (`SessionsList`, over `ShellSessions`). The shell sends every click
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
as the page arrives, the way it does for a link. The dock pair is the git
dock the code island keeps under its page: the island says which surface is
up, and the rail's Branches and History press the web rail's own button back
over the bridge (`pickDockTab`), or put the dock away when the native pane
takes the foot of the window. One island is hosted today: the page (`code`).

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
  State/                 AppModel, WindowTab, BottomPaneTab, DockSurface, FileTree, SidebarTree, SidebarSessions, QuickSearch (+ the ⇧⇧ monitor)
  FileIcons/             FileIcon (resolver + rasteriser) over the generated @pierre/trees sprite
  Islands/               IslandHost (web view + bridge), SpaSource, SpaSchemeHandler, IslandView
  Terminal/              TerminalSession — the shell behind the Terminal surface
  Services/              DevServices + DevProcessStream — dev commands and their output
  Views/                 ContentView (split view), Sidebar, Tabs, BottomPane, Search, Launchpad, Welcome
```

Not here yet: native menus for the islands' popovers, drag and drop between
the sidebar and the islands, more than one terminal.
