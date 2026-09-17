# @reviewer/mac-os

A native macOS shell for Reviewer, written in SwiftUI. Same embedded API
server as the Electron desktop app; the window, sidebar, tabs and menu bar are
AppKit's own.

What it does today (a deliberately basic agentic IDE):

- **Native sidebar** — the project's file tree (git status tinted) and the
  most recent agent sessions, both in one system sidebar list.
- **Tabs** — files and agent sessions open as tabs in an Xcode-style strip;
  ⌘W closes, ⌘⇧] / ⌘⇧[ cycle, unsaved files show a dot.
- **Editor** — a plain monospaced buffer with ⌘S save through the server.
- **Agent sessions** — ⌘N starts one in the open project (the server's default
  provider/model); the transcript streams over the chat WebSocket with tool
  activity folded in, and can be stopped mid-turn.
- **Projects** — ⌘O opens a folder through `NSOpenPanel`; recents come from
  the server.

## Running

```bash
pnpm --filter @reviewer/mac-os dev
```

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
  State/                 AppModel (tabs, project, sessions), OpenFile, ChatSession, FileTree
  Views/                 ContentView (split view), Sidebar, Tabs, Editor, Chat, Welcome
```

Not here yet: syntax highlighting, diffs/review comments, terminal, model
picker for new sessions, image attachments. The web SPA remains the full
product; this is the native shell to grow those into.
