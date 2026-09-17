# @reviewer/mac-os

A native macOS shell for Reviewer, written in SwiftUI. Same embedded API
server as the Electron desktop app; the window, sidebar, tabs and menu bar are
AppKit's own, and the web app's surfaces are hosted inside it as **islands** —
each one a web view of its own, set in the native layout, showing one part of
the SPA.

What it does today:

- **Native sidebar** — the project's file tree (git status tinted) on the
  system's full-height sidebar material. Picking a file sends the code island
  to it; a file the island opens on its own highlights here.
- **Native tabs** — the window bar's tabs, natively: Code and Sessions pinned,
  then one per agent session (⌘T mints one; ⌘W closes, ⌘⇧] / ⌘⇧[ cycle, ⌘1–9
  jump). Each remembers the last place it was.
- **Launchpad** (⌘L) — every tab as a card wearing the last picture taken of
  it, over the window.
- **Page island** — the SPA's routed page, with its own chrome and file tree
  off: the diff, the file view with its file strip, review comments, edit
  mode, the sessions surface.
- **Bottom pane** (⌘B) — a native strip over six surfaces. Terminal is the
  user's shell in the project (SwiftTerm); Services is the project's dev
  commands, listed, started and stopped natively, with each one's output
  drawn from the server's process socket. Branches, History, Find and
  Threads are the dock island, on the SPA's own dock pages.
- **Projects** — ⌘O opens a folder through `NSOpenPanel`; recents come from
  the server.

## Islands

An island is the SPA loaded with `window.reviewer.island` set — the bridge the
shell installs before the first script runs (`IslandHost`). The app's `_app`
layout then renders `IslandLayout` instead of `AppLayout`: the routed page with
no frame, rail, header or dock around it, since those are the window's. Same
routes and URLs, so the shell steers an island with the hrefs the app already
uses. The contract is small and lives in `packages/spa/src/lib/shell.ts`:

- shell → island: `navigate(href)`, `refresh`
- island → shell: `ready`, `navigated(href)`

Islands cannot share a JavaScript heap, so whatever two of them both need —
project, tabs, selection, where the code surface points — lives in `AppModel`,
and the shell is the one that navigates. Two islands are hosted: the page
(`code`) and the dock (`dock`, `GitBottomDock` chromeless on one of the dock
pages). When the dock reaches for the page — a commit picked out of History —
the shell hears where it went, sends the page island there on the Code tab,
and puts the dock back.

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
  State/                 AppModel, WindowTab, BottomPaneTab, FileTree
  Islands/               IslandHost (web view + bridge), SpaSource, SpaSchemeHandler, IslandView
  Terminal/              TerminalSession — the shell behind the Terminal surface
  Services/              DevServices + DevProcessStream — dev commands and their output
  Views/                 ContentView (split view), Sidebar, Tabs, BottomPane, Launchpad, Welcome
```

Not here yet: native menus for the islands' popovers, drag and drop between
the sidebar and the islands, more than one terminal.
