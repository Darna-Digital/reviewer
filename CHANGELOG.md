# Changelog

## v0.0.43 — 2026-11-05

### Fixed

- Clicking Reviewer's Dock icon brings the window back when it's minimised, not only clicking the minimised window itself.

## v0.0.42 — 2026-11-04

### Changed

- In the terminal UI, ⌃G and the palette's Generate commit message work from any page, as in the Mac app. Away from the commit box, the message is drafted from every change and waits in Review's commit box.

### Fixed

- The terminal UI's empty Review and Browse screens show the keys that actually work, including ⌘K for commands.

## v0.0.41 — 2026-11-03

### Fixed

- In the terminal UI, clicking the History, Usages, Run or Pull request tab no longer shrinks the bottom pane by a row each time.

## v0.0.40 — 2026-11-03

### Added

- Install Reviewer's terminal UI on macOS or Linux in one line: `curl -fsSL https://reviewer.sh/install | bash`. It installs into `~/.reviewer` with the Reviewer server and the Node.js it runs on, and `reviewer upgrade` installs the latest release.
- The installed terminal UI offers new releases in its ⌘K palette and updates itself, as the Mac app does.

## v0.0.39 — 2026-11-03

### Changed

- The sessions list's filter narrows to a saved workspace, or to one repository whether you opened it alone or inside a workspace, in place of a project. Each choice shows how many sessions it holds.
- In a workspace, every git action in the ⌘K palette asks which repository it's for first, as Push already did. Switch branch… lists the branches of the repository you pick, and Refresh and Create branch… ask too.

## v0.0.38 — 2026-11-02

### Fixed

- In a workspace, moving to another repository keeps the page you're on instead of jumping to the first open tab. It shows that repository's own tab, or nothing if it has none.
- A session tab's ✕ appears exactly where its activity dot sits, and clicking it always closes the tab.

## v0.0.37 — 2026-11-02

### Added

- Commit details show the SHA as a chip you can click to copy. In a workspace it copies `repository@sha`; right-click to copy the full or the short SHA.

### Changed

- In a workspace, branch actions (checkout, update, fetch, pull, push, merge, rebase, create, rename, delete, compare and review) run in the repository you picked them from, and their notices name that repository.
- Right-clicking a symbol at its own declaration no longer offers Go to definition, which would only have found its usages.

## v0.0.36 — 2026-11-02

- Internal improvements.

## v0.0.35 — 2026-11-02

### Added

- Workspaces: open several repositories side by side in one window. Save a named, ordered set of repositories as a workspace from the opener or the toolbar's menu, or open a few together without saving. Each repository stays live with its own status, branches, terminals, dev commands and pull requests.
- In a workspace, the sidebar lists each repository's changes under its own header, and only the repositories that have something to commit. The commit box takes changes from several repositories at once and commits in each, and Generate commit message drafts one message that covers all of them.
- The bottom pane spans the workspace. Run lists every repository's dev commands and Start all brings the whole workspace up. Branches lists every repository in one outline. History and Terminal have a repository picker.
- Go to file and Find in files search every repository in the workspace.
- Merge requests lists pull requests from every repository on GitHub, each under its own header.
- Agent sessions started in a workspace work across all of its repositories. The session bar names the workspace, and its branch menu steps from a repository to that repository's branches.
- Fetch, Pull, Push, Commit and Commit and push in the command palette ask which repository they're for, or all of them.
- Generate commit message works from anywhere with ⌃G or ⌘E, not just with Review on screen. The draft waits in Review's commit box.
- Session tabs show each session's agent icon, and a new session tab keeps its own agent, model and effort settings until you send.

### Changed

- The window has a new toolbar. Session tabs share one bar: drag to reorder, middle-click or ✕ on hover to close, and ⇧⌘1–9 to switch. Browse, Review and Merge requests are now ⌘1–3.
- The toolbar chip shows where you're working, this Mac and the open workspace. Its menu lists your workspaces, then recent repositories, favorites and all repositories.
- The sidebar's title shows the repository over its current branch. What the changes are compared against now sits in the filter row ("vs main").
- Repositories show their own avatars wherever they're listed.
- The bottom pane's controls sit on one glass bar beside its tabs. History's filters are in a menu. Terminal shells are tabs that scroll sideways when there are many. Bar buttons name themselves in a quick tooltip.
- Open editor tabs are kept per workspace, so moving between repositories no longer swaps them out.
- The sidebar steps aside while you write a new session and comes back afterwards. With the sidebar folded, the page takes the full width and the workspace chip stays on the toolbar.
- The lit Code/Sessions tab is a neutral grey instead of the accent colour.
- Settings, what's open and your recent repositories are kept in one store shared by every window and the TUI, so they no longer overwrite each other.

### Fixed

- New workspace now opens its editor on the first click.
- Deleting a session no longer lands you back on it or reports a lost connection.
- Search fields no longer shift their text when you click into them.
- Long tooltips, such as a repository's path near the screen's edge, stay on one line instead of breaking into fragments.

## v0.0.34 — 2026-10-29

### Changed

- Every message about something you did — discarding a file or a single change, saving, assigning comments, a dropped image that is too large — now appears in the same notice stack at the bottom corner of the window as git's push and commit notices, instead of in a separate pop-up inside the page that could end up hidden under a panel.
- Notices are easier to read: the headline is lighter, the explanation under it is set at the same size with more space between lines and can run a little longer, and the icon lines up with the first line of text.

## v0.0.33 — 2026-10-29

### Fixed

- Reviewer's built-in server is no longer reachable from other computers on your network or from websites open in your browser, either of which could previously have opened a terminal on your Mac. The app, the TUI and your agents connect just as before.

## v0.0.32 — 2026-10-28

### Changed

- Right-clicking a branch in the Branches pane now opens the same menu as the branch picker, right at the pointer. Long branch names are shortened in the middle, and resting on an item shows it in full.
- The lines between groups in the branch menu are thinner.

## v0.0.31 — 2026-10-28

### Changed

- The toolbar's buttons now show the same glass label as the rail when you rest the pointer on them: Code and Sessions, the sidebar toggle, the project picker and the new-session button, each with its shortcut. Once one label is up, it glides straight to the next button you point at.

## v0.0.30 — 2026-10-28

### Changed

- The rail's buttons are now glass tabs: a glass highlight sits under the surface you're on and springs to the next one when you switch. Drag it up or down the rail to change surface; on a Force Touch trackpad you feel a tick as it passes each icon.
- Resting the pointer on a rail icon shows its name and shortcut beside the rail. Search now sits with Browse, Review and Merge requests, and lights up while Go to file or Search in files is open.

### Fixed

- Adding a new line in a `.env` file no longer scrolls the whole view, and the caret stays on the line you're typing in.

## v0.0.29 — 2026-10-28

### Changed

- Selecting text in a `.env` file no longer offers to start a comment. These files hold secrets and settings rather than code under review, so they take no comments.

## v0.0.28 — 2026-10-28

### Changed

- The Code and Sessions switch in the toolbar, the Branches, History, Terminal and Run tabs in the bottom pane, and the Appearance choice in Settings now use macOS's glass tabs. Click a tab, or drag the highlight across to it.

### Fixed

- In the command palette (⌘E), titles, shortcuts and group headings now line up with their icons instead of sitting slightly high.

## v0.0.27 — 2026-10-27

### Fixed

- In the side-by-side diff, the ribbons linking changes on the left to the right no longer jitter or flash another file's ribbons as you scroll.

## v0.0.26 — 2026-10-26

### Changed

- Updated the app's dependencies to their latest versions, including the built-in terminal, the diff viewer, React, Effect and the resizable panels.

## v0.0.25 — 2026-10-20

### Added

- A Git menu with the shortcuts the terminal version uses: ⇧⌘B switches branch, ⌃G generates a commit message, ⌘K commits and ⌥⌘K commits and pushes. They also appear in the command palette. If a commit can't go through yet, you now get a notice saying why, such as no files ticked or no message written.
- The command palette answers ⌃N and ⌃P to move through the list and ⌃K to go back to the commands. In the text search, ⌥C, ⌥W and ⌥R turn match case, whole word and regular expression on and off.

### Changed

- Go to file is now ⇧⌘O only. Double-tapping Shift no longer opens it, and the empty-pane hints show the new shortcuts.

## v0.0.24 — 2026-10-20

### Changed

- The window is now titled with the repository's name and where it lives, for example "reviewer — …/reviewer-project". With several repositories open at once, you can tell them apart in Mission Control, App Exposé, the Window menu, and on a minimized window's Dock tile.

## v0.0.23 — 2026-10-16

### Changed

- Commit messages drafted with Claude now come back faster: Claude writes them with Opus at low effort.

### Fixed

- Generating a commit message from the Changes sidebar now fills in the message as soon as it is ready. Before, the message often never appeared until you clicked into the diff.
- Popovers such as the sessions filter, the branch and compare pickers, and the model picker now close when you move to another page, instead of staying open over a page they no longer belong to.

## v0.0.22 — 2026-10-15

### Changed

- Switching between Files, Changes, Merge requests and Sessions in the sidebar is smoother. A page you have already visited comes back at once instead of being rebuilt, and the sidebar no longer stutters as the rail and the search bar slide in and out.
- Coming back to a session, or switching back to Sessions, is quicker when the conversation has long replies in it.

### Fixed

- Diffs now update on their own when files change — an agent editing them, a save from another editor, or a commit on the branch. Before, a diff on screen could keep showing old changes until you refreshed with ⌘R.
- Coming back to the window now refreshes the diff and the file status every time, not only the first time.
- Long conversations no longer come back as a blank page: returning to a session with a very long reply in it now shows the reply.

## v0.0.21 — 2026-10-14

### Fixed

- In long sessions, messages you send and the agent's replies now show up as they happen. Before, a long conversation stopped updating once it was open, and you had to leave and reopen it to see anything new.

## v0.0.20 — 2026-10-14

### Changed

- The sessions list in the sidebar now scrolls smoothly however many sessions you have, even with several agents working at once.
- The project filter in the sessions list now shows each project's folder under its name, so two copies of the same repository are easy to tell apart. Searching the filter matches folder paths too, and a path too long for its row shows in full when you point at it.

## v0.0.19 — 2026-10-14

### Added

- Pickers and menus that pop up now work from the keyboard: ↑/↓ move through the list, Return picks, and Escape closes. This covers the branch picker, the model picker, the effort, mode and access selectors, the commit message agent picker, the review target picker, the review comments list and the sessions filter.
- In the branch picker, → opens the highlighted branch's actions and ← goes back to the list.
- In the model picker, ← moves to the agent rail, where ↑/↓ switch agents; → or Return goes back to the models.
- In the review comments list, Delete removes the highlighted comment.

## v0.0.18 — 2026-10-10

### Added

- ⌘F now finds on the page you're on: on a diff it jumps to the changed-files filter, and with a file open it opens that file's find bar. Text you have selected is used as the search.
- On a pull request, the comment bar now has an Open on GitHub button that takes you to the pull request, where its comments are answered.

### Fixed

- Pull requests whose branch hadn't been fetched into your checkout now open their diff, instead of failing to load it.

## v0.0.17 — 2026-10-10

### Added

- You can now edit your own comments on a pull request. Hover a comment you wrote and click Edit, and the change is saved to GitHub. As on GitHub, other people's comments can't be edited.

### Changed

- Edit now appears on each of your comments instead of once at the bottom of a thread, so you can edit any of your comments in a conversation, not only the first.

## v0.0.16 — 2026-10-09

### Changed

- The command palette now opens with ⌘E instead of ⌘K, matching the terminal app.
- Long comments in the diff now span the full width of the diff instead of a narrow 400px card. Short notes still sit beside their line.
- The comment list in the bottom bar shows each comment as a compact preview with its title in bold, instead of raw Markdown with blank gaps.

### Fixed

- Clicking a comment in the bottom bar takes you to it in the pull request's diff, with the line near the top and the thread open under it, every time. It used to open the file without its pull request comments, or not move the diff at all after the first jump.
- Opening a comment from the bottom bar scrolls the pull request's overview out of the way so the diff is in view.

## v0.0.15 — 2026-10-07

### Fixed

- Updated third-party dependencies to versions that fix known security vulnerabilities.

## v0.0.14 — 2026-10-06

### Added

- PHP support in the code views: go to definition, find usages, hover docs, completions and problems, powered by intelephense. Reviewer uses the intelephense (or phpactor) already on your Mac when there is one.
- No PHP language server? Settings → Languages can install intelephense for you, without needing Node.js or npm on your Mac.
- Laravel references are clickable: `view()`, `config()`, `env()`, `__()`, Blade `@include` and `@extends`, `<x-…>` components, Livewire tags and Inertia pages open the file and line they name.
- In Laravel apps that use PHPStan or Larastan, its findings show next to the language server's, checked against the project's own `phpstan.neon`: the same files, at the same level.
- Settings has a new Languages section showing which language server each language uses, or why one is missing.
- PHP and Blade files have their own icons.

### Changed

- The Check Out button on a pull request now lights up in the theme's accent colour on hover instead of turning grey.

### Fixed

- Comments you post on a GitHub pull request can be resolved straight away, without waiting for a refresh.
- Switching branches no longer leaves the review comparing against a branch chosen for the previous one.
- Tabs no longer vanish from the tab bar for a while after quickly resizing the window or snapping it to half the screen.

## v0.0.13 — 2026-10-06

### Changed

- Updated the app's npm dependencies to their latest versions. The built-in server now runs on the first stable release of Effect 4 instead of a beta, and the diff viewer, syntax highlighting, resizable panels and icons all move to their newest releases.

## v0.0.12 — 2026-10-05

### Added

- You can now resolve and reopen GitHub review conversations right from the comment thread. Resolved conversations fold away so open ones stand out, and you can expand them again at any time.
- Pull requests now open on a single page that shows the overview, the file tree and the diff together. A side panel next to the overview lists actions, checks, reviewers, assignees and labels.
- Pull request authors and reviewers now show their GitHub avatars.

### Changed

- The pull request header is simpler: a clear title, who opened it and when, and the branches it merges between. A small "Draft" badge appears only on drafts, and you can select the branch names to copy them.
- Long pull request descriptions are now collapsed, with "Show more" to read the rest.
- The pull request list header is less cluttered, and timestamps in the list are easier to read.

### Fixed

- Markdown tables with wrapped text no longer overlap the content below them.

## v0.0.11 — 2026-09-30

### Added

- Long branch names in the branch switcher now show in full in a tooltip when you hover over them. Each branch also gets a submenu of actions whose long items are shortened instead of stretching the menu, and you can hover any shortened item to read all of it.

### Fixed

- "Hide sidebar" / "Show sidebar" in the command palette now actually toggles the sidebar instead of undoing itself as the palette closes.
- Pasted text in the terminal is readable again in the light theme; it used to show as black on dark.
- When you assign something to a new chat, the chat now uses the model you picked.
