# Changelog

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
