# @reviewer/mac-os

A native macOS shell for Reviewer, written in SwiftUI, over the embedded API
server; the window, sidebar, bottom pane and menu bar are AppKit's own, and the web app's surfaces are hosted inside it as
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
  commit view's controls. Both pickers — and the history's ref, and the
  session bar's branch — open the one popover (`BranchPopover`): a search
  over the rows, ↑/↓ walking them under the field, Return picking the lit
  one, Escape clearing then closing, a name too long for its row said in
  full in its tooltip while it is cut (`clipHelp`); the switcher's rows
  carry the web switcher's actions at the ellipsis and on a right click. The rows wear @pierre/trees' own
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
  first, with the web list's marks on each row — drawn natively from what
  the page reports (`SessionsList`), under
  the web rail's search and filter menu (the project, how far back), both
  of them the page's own server query. Picking one sends the page island to
  that conversation on the Sessions tab; the context menu lifts it into a
  tab of its own or deletes it, and the foot of the list fetches the next
  page.
- **Sessions** — the conversation itself is drawn natively in the page
  island's place while the island is on a session's address, read from the
  server by the shell itself (`ChatSession` over `/api/chats/:id` and the
  `/api/chats/stream` socket, folded through the web reducer's twin, with
  the same reconnect-and-watchdog): prompts as bubbles with their images,
  replies as markdown under each turn's work log — the tool calls and
  thinking folded to one line, opening to a row per step and each step to
  its input and output — the indicator naming the work in flight, a failed
  turn's error, and the composer under it all (`ChatComposer`): the prompt
  box, dragged taller by its top edge, over the model picker (agents down a
  rail, a search, stars for favourites), the effort, mode and access
  selectors — each only what the chosen agent can be asked for — the attach
  button, and send or stop; images are picked, pasted or dropped anywhere
  on the pane. Under it the strip naming the project and the branch, the
  sidebar's own picker. ⌘T's composer is the same, centred, opening on the
  settings the last session was composed with; the first send makes the
  chat and steers the island to it. The island keeps the tab strip and the
  sessions list; on these pages it shows nothing of its own, and is told
  when the conversation moved (`sessions(refetch)`) so the rows' marks
  follow.
- **Islands** — beside the sidebar the window is laid out as rounded
  panels standing a few points apart on the web app's frame colour: the
  page island and the bottom pane, with a seam between them that resizes
  the pane; the sidebar's own edge resizes it, and its toggle or ⌃⌘S puts
  it away, when the rail moves out onto the frame beside the page. The toolbar and the
  rail are the bare window around them.
- **Window tabs** — the web app's own strip, drawn natively on the toolbar:
  Code and Sessions pinned, then one per agent session (⌘T mints one;
  ⌘W closes, ⌘1–9 jump to a session, ⌘G crosses between Code and Sessions,
  ⌘⇧] / ⌘⇧[ step along the strip). The
  strip lives in the page island — switching is a route change inside it,
  every tab's page primed while the window is idle — and
  sends the toolbar a picture of itself; a tab pressed there, and each menu
  chord, goes back down to the strip to answer.
- **Page island** — the SPA's routed page, with the window's own chrome and
  file tree off: the diff, the file view, review comments, a
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
  upstream; a double-click checks out, the context menu is the switcher's, and the
  empty space under the rows has the surface's own — new branch, update,
  push. History is the web history dock: the filter bar — the branch the
  log follows; the file it is narrowed to;
  a text or hash with the regex and case toggles; an author; a date to
  start from — over the commits, each row its lane in the graph, its
  refs, its subject, its author and its date, paged in as the list nears
  its end (`/api/log`). A commit picked opens on the page and stands beside the list
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
- **Palette** — the web app's search dialog as a Liquid Glass pane over
  the page, the same stack of lists under one box with a breadcrumb over
  it: ⌘K opens on the commands — where to go, the git actions behind
  their own list (fetch, pull, push, a new branch, and Switch branch…
  behind that), the window's own (the diff style, asked of the page; the
  bottom pane and its surfaces; the sidebar), the opener, a new session — the ways into the two searches among them. ⇧⇧ or
  ⌘⇧O goes straight to Files, a name search over every path (the same
  fuzzy match, capped the same); ⌘⇧F to Text, a grep of the working tree
  through the server (`/api/search`) with the case, whole-word and regex toggles, opening
  on whatever the page has selected. ↑/↓, Home and End walk the list,
  Return runs the row, Backspace on an empty box walks back up the trail,
  Escape puts it away. The list is a native table (`PaletteList`), its
  rows reused as they scroll, the files and the grep's headings wearing the
  tree's own file icons. A result opens in the page island where the web
  palette would open it — in place on a code surface, otherwise on the
  diff. The pane, and the assign bar, stand over the page for real: the
  island's web view (`IslandWebView`) checks each hover against the
  window's hit test and lets go of the page while something native is in
  front, so the diff under the glass stops answering the pointer.
- **Opener** — a project is one git repository, and the way to another
  is a Finder window over every repository the machine holds
  (`RepoOpenerWindow`, over `RepoCatalog`): the sidebar's glass pane with
  Recents and All Repositories at its head and, under Locations, each
  folder holding more than one; the list's name as the title on the
  toolbar, the search at its trailing edge, a rescan and the folder panel
  beside it; and the repositories as the system's table — name, branch,
  where it sits, when it was last opened — sortable on any column, a
  status bar along the foot counting them and saying while the server's
  walk is still filling the list in. A double-click or Return opens the
  row as the project, the row's menu reaches it in Finder. It is the
  window up while no project is, and the one ⌘O, ⇧⌘1 and the project chip
  at the head of the sidebar bring up over an open workspace; a repository
  opened in it hands back to the workspace. The list is the server's
  (`/api/repos`, `POST /api/repos/scan`): a walk of the home folder —
  skipping `Library`, dependency and build output and anything hidden, and
  never stepping into a repository it found — kept in
  `~/.reviewer/repos.json` and started over in the background at boot and
  on request, each repository stamped with when it was last opened here.

- **Settings** (⌘,, and the app menu's Settings…) — the system's grouped
  form: the appearance the window is drawn in — System, Light or Dark, held
  on `NSApp.appearance` so the chrome, the sheets and the islands' web views
  all follow the one switch, each island told to follow its view rather
  than a scheme of its own; the theme it is drawn with, one for each scheme
  — the app's own pair, Pierre's, or any Shiki bundles (Tokyo Night,
  Catppuccin, Dracula, Nord, Solarized…), the catalog read from
  `/api/themes` — where a chosen theme is read by the server for the
  window's palette (`/api/themes/{name}`, `deriveChromeTokens` in core: the
  editor's background is the sheet, the sidebar's the frame, the rest taken
  or derived from there) and the shell paints its frame, islands, panes,
  type and tint from it (`ChromePalette`, `IslandPalette`) while handing
  each island the same tokens as `--chrome-*` and the theme names for its
  code (`NativePalette`) — on the app's own pair nothing is derived, and
  the window stays its two tones and the system's colours exactly as
  before; who git signs commits as in the project
  (`/api/identity`, its `user.name` and `user.email`, this project's over
  the global ones); and who the server is signed in to GitHub as
  (`/api/github/auth` — the login behind `GITHUB_TOKEN`/`GH_TOKEN` or the
  `gh` CLI's token, or that there is none), with what to run to change
  either under each. The palette's Open settings lands here.
- **Projects widget** — the opener's lists as a desktop or Notification
  Centre widget, so a project is one click from open without the app up.
  Two widgets in the gallery under Reviewer, *Recent projects* and
  *Favorite projects*, each in the three sizes: small is the open project
  — or the last one — on its own; medium four tiles and large ten, each a
  repository with its branch on its monogram (`RepoMonogram`, the avatar
  the opener's rows wear). Nothing marks the project this machine has
  open: a widget is a list of projects to open, and every tile is one. A
  click is
  the opener's Open and run — the project opened with its dev commands
  started and the Run surface up — since a project reached from the
  desktop is one about to be worked on. Each tile is a
  `reviewer://open?path=…&run=1` link (`ProjectLink`): Launch Services
  brings the app up or forward with it, and the app does what the opener's
  own row does — held for the server while the app is still launching
  (`ProjectLinks`,
  `AppModel.open(link:)`). A window holds one project, so a link naming
  another one while this window has its own opens a window beside it
  rather than taking this one away — several projects at once is what the
  widget is for — and that window starts the dev commands as it comes up
  (`REVIEWER_RUN`, see `ServerLauncher`). An empty window takes the
  project itself, which is the window a click launched; the project
  already open stays where it is and only runs. That link is the whole of
  a widget's reach: it draws into an archive the system renders, so there
  is no menu to raise on a right click and no hover to answer.
  The widget runs sandboxed in a process of its own, so what it lists is a
  feed the app writes (`ProjectWidgetFeed` → `ProjectFeed` in
  `ReviewerShared`) whenever the catalog or the open project changes,
  asking WidgetKit for a redraw each time; a widget with no feed to read
  says so, and its click brings the app up, which writes one.
  It is two static widgets rather than one with a setting because a
  configurable widget's setting is an App Intent, whose metadata only
  Xcode's build extracts.

  Three things an extension gets from Xcode that a SwiftPM one has to be
  given by hand, each of which leaves the widget missing from the gallery
  on its own:

  - **`-e _NSExtensionMain`** (`Package.swift`) — an extension enters at
    NSExtensionMain, the XPC bootstrap that answers the widget host asking
    which widgets the bundle vends. Left at Swift's own `main` the process
    comes up with no listener and the host never hears back.
  - **A sandbox, and a feed it can read** (`Resources/Widget`) — PlugInKit
    refuses to register an app extension that is not sandboxed, so the
    sandbox is not optional. But the group container a sandboxed extension
    would share with the app is only granted to a signature carrying a team
    identifier, and a local build has none: the sandbox refuses it the file
    with `deny file-read-data`. So the feed goes to
    `~/.reviewer/projects.json` beside the server's own state, which the
    extension is let into by a read-only
    `temporary-exception.files.home-relative-path` entitlement, and to the
    group container as well once there is a team identifier to make one
    worth having (`ProjectFeed.feedURLs`, gated on
    `ProjectFeed.teamIdentifier`); the widget tries them in that order.
    Note that inside the sandbox `NSHomeDirectory()` is the extension's
    container, so both sides take the home folder from the password
    database (`ProjectFeed.homeDirectory`).

    Both of the places the feed used to go are app data as macOS counts
    it, and `~/Library/Containers` and `~/Library/Group Containers` are
    data vaults: a look inside either goes through the sandbox daemon to
    TCC, which raised "Reviewer would like to access data from other apps"
    at the app on every launch — the extension's own container by hand,
    the group container through
    `containerURL(forSecurityApplicationGroupIdentifier:)` — and refused
    the widget silently, since a widget may not prompt. Unsigned by a team
    neither was any use to the widget in the first place, so nothing now
    asks for either.
  - **Registration after every bundle** (`scripts/bundle.sh`) — the bundle
    is torn down and rebuilt on each call, which leaves Launch Services
    and the widget host holding a path that has gone; the host then says
    "Unable to find … extension directly" and the placed widgets keep
    their last drawing. The script registers the app and the extension
    again at the end, as an install would.

## Islands

An island is the SPA loaded with `window.reviewer.island` set — the bridge the
shell installs before the first script runs (`IslandHost`). The app's `_app`
layout then renders `IslandLayout` instead of `AppLayout`: the routed page with
no frame, rail, header or dock around it, since those are the window's. Same
routes and URLs, so the shell steers an island with the hrefs the app already
uses. The contract is small and lives in `packages/spa/src/lib/shell.ts`:

- shell → island: `navigate(href)`, `refresh`, `windowTabs(action)`,
  `tree(action)`, `sessions(action)`, `dock(close)`, `review(action)`,
  `view(action)`
- island → shell: `ready`, `navigated(href)`, `windowTabs(strip)`,
  `tree(listing)`, `treeState(selection, commit composer)`, `sessions(list)`,
  `dock(shown)`, `history(path)`, `review(comments)`

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
asks the shell, whose History surface answers. The review pair is the web
assign bar, floated over the page island natively (`ReviewAssignBar`, over
`ReviewHandoff`): while the page holds review comments — on the diff, on
the running app — it reports them, and the shell hangs a capsule of Liquid
Glass near the page's foot, as Music hangs its player over the window: the
count, opening the comments as a list to jump around the review from; the
target — a fresh chat with an agent, or a session already running, the ones
on the comments' branch leading — with the composer's own model picker
beside it while a fresh chat still has a model to choose; Assign; and the
fold to a count chip at the page's trailing edge. The sessions and the
catalog the picker lists are the shell's own reads of the server; what the
bar does goes back to the page, whose comments and hand-off these are — the
chat made, the prompt built, the comments resolved, the jump to a line.
`view(action)` is the one event with no reply: the palette's Toggle Diff
Style, a preference the page keeps since the diff is its to lay out.
One island is hosted today: the page (`code`).

Where the documents come from is `SpaSource`: a debug build takes the Vite
dev server on `:41812` (HMR inside the native window); a release build takes
the SPA build bundled into `Contents/Resources/spa` by `scripts/bundle.sh`,
served over `reviewer://app`. `REVIEWER_SPA_URL`
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
`pnpm --filter @reviewer/embedded-server start`, and stops it again on quit.
A server already running — `pnpm dev`, or another window's — is reused as is.

An app installed outside the repository (copied to `/Applications`) has no
repository to walk up to, so it runs the server bundled into it instead:
`pnpm build:mac` builds the server with esbuild (`build:bundle`) and
`scripts/bundle.sh` copies it, with node-pty beside it, into
`Contents/Resources/server`, where the app starts it with the `node` from
your login shell.

Requires Xcode 16+ (Swift 6 language mode) and macOS 15.

### Signing

`scripts/bundle.sh` signs the app and the widget extension with the
self-signed **Reviewer Dev** certificate when the login keychain holds one,
and ad-hoc (`--sign -`) when it does not; `SIGN_IDENTITY` overrides both.
Which one it used decides whether the app's privacy grants — Automation,
Accessibility, the folders it is let into — outlive the build. TCC files
an answer against the app's designated requirement, and ad-hoc that
requirement *is* the code hash: every `swift build` produces what the
system reads as a different app, so every grant is thrown away and every
dialog returns on the next relaunch under `watch.sh`. Signed with the
certificate the requirement names the identifier and the leaf instead, and
the grants hold.

```bash
scripts/create-signing-identity.sh   # once: make the certificate
scripts/fix-permissions.sh           # re-sign, clear stale grants, relaunch
```

The first is enough on a fresh machine; the second is for a working copy
whose grants were recorded against hashes that no longer exist.

The widget's feed no longer goes through the extension's sandbox
container, so the "access data from other apps" dialog that used to greet
every launch is gone — see the Projects widget above for where the feed
is written instead. A copy the old builds left behind can be thrown away:

```bash
rm -f ~/Library/Containers/com.byconvo.reviewer.macos.widget/Data/Library/Application\ Support/projects.json
```

## Layout

```
Sources/Reviewer/
  ReviewerApp.swift      @main, menu commands, app delegate
  Server/ServerLauncher  reachability check + spawn of the embedded server
  Api/                   Codable mirrors of the core schemas, HTTP client, chat socket
  State/                 AppModel, AppSettings, ProjectLinks + ProjectWidgetFeed (the widget's link in, feed out), Chrome (the theme's palette), WindowTab, BottomPaneTab, DockSurface, ViewAction, CommitHistory, CommitGraph, FileTree, SidebarTree, SidebarSessions, PullRequests, Chats, ChatSession, ChatSettings, WorkLog, ComposerAttachment, RepoCatalog, CommandPalette + PaletteCommands (+ the ⇧⇧ monitor)
  FileIcons/             FileIcon (resolver + rasteriser) over the generated @pierre/trees sprite
  Islands/               IslandHost (web view + bridge), IslandWebView, NativePalette (the palette as CSS), SpaSource, SpaSchemeHandler, IslandView
  Terminal/              TerminalSession — the shell behind the Terminal surface
  Services/              DevServices + DevProcessStream — dev commands and their output
  Views/                 ContentView (split view), Sidebar, PullRequests (list, overview, column), Chat (conversation, composer, model picker), Tabs, BottomPane, Palette (panel, list), Review (assign bar), Opener, Settings
Sources/ReviewerShared/  what the app and the widget agree on: ProjectFeed (the widget's feed), ProjectLink (reviewer://open), RepoMonogram
Sources/ReviewerWidget/  the WidgetKit extension: the Projects widget (recents, favourites) and its views
Resources/Widget/        the extension's Info.plist and entitlements; Resources/Reviewer.entitlements is the app's own
```

Not here yet: native menus for the islands' popovers, drag and drop between
the sidebar and the islands, more than one terminal.
