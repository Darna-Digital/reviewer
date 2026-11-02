// What the command list offers — the web palette's commands, answered by
// the shell: where to go, what to do with git, what to show of the window,
// and the project. The web builds them in the shells that have navigation,
// git and preferences in scope; here that is the model, which has the
// page, the pane and the server. Read afresh each time the list is shown,
// so a toggle's label says what it would do next. The searches the list
// leads into are the palette's own (see `PaletteSubmenu`).
import Foundation

extension AppModel {
    func paletteCommands() -> [PaletteCommand] {
        navigationCommands + gitCommands + commitCommands + viewCommands + projectCommands + sessionCommands
    }

    private var navigationCommands: [PaletteCommand] {
        [
            PaletteCommand(
                id: "go-review", label: "Go to review", group: "Navigation", symbol: CodeSurface.review.symbol,
                keywords: "commit working tree changes diff local", hint: CodeSurface.review.railShortcut.hint
            ) { [weak self] in self?.show(surface: .review) },
            PaletteCommand(
                id: "go-reviews", label: "Go to merge requests", group: "Navigation",
                symbol: CodeSurface.reviews.symbol, keywords: "merge request mr review pr github pull requests",
                hint: CodeSurface.reviews.railShortcut.hint
            ) { [weak self] in self?.show(surface: .reviews) },
            PaletteCommand(
                id: "go-browse", label: "Browse the project", group: "Navigation", symbol: CodeSurface.browse.symbol,
                keywords: "files history commits explore", hint: CodeSurface.browse.railShortcut.hint
            ) { [weak self] in self?.show(surface: .browse) },
            PaletteCommand(
                id: "go-settings", label: "Open settings", group: "Navigation", symbol: "gearshape",
                keywords: "theme dark light system appearance preferences git github", hint: "⌘,"
            ) { [weak self] in self?.showSettings() },
        ]
    }

    /// The git actions sit in the palette's own Git list rather than the
    /// root one, so the list you land on stays short.
    private var gitCommands: [PaletteCommand] {
        [
            PaletteCommand(
                id: "git-refresh", label: "Refresh", group: "Git", symbol: "arrow.clockwise", keywords: "reload sync",
                hint: "⌘R", submenu: .git
            ) { [weak self] in Task { await self?.refresh() } },
            PaletteCommand(
                id: "git-fetch", label: "Fetch", group: "Git", symbol: "icloud.and.arrow.down", keywords: "remote",
                submenu: .git, choices: repositoryChoices(in: roots) { [weak self] in self?.fetch(in: $0) }
            ) { [weak self] in self?.fetch() },
            PaletteCommand(
                id: "git-pull", label: "Pull", group: "Git", symbol: "arrow.down", keywords: "remote update",
                submenu: .git, choices: repositoryChoices(in: roots) { [weak self] in self?.pull(in: $0) }
            ) { [weak self] in self?.pull() },
            PaletteCommand(
                id: "git-push", label: "Push", group: "Git", symbol: "arrow.up", keywords: "remote upload",
                submenu: .git, choices: repositoryChoices(in: roots) { [weak self] in self?.push(in: $0) }
            ) { [weak self] in self?.push() },
            PaletteCommand(
                id: "git-branch", label: "Create branch…", group: "Git", symbol: "arrow.triangle.branch",
                keywords: "new checkout", submenu: .git
            ) { [weak self] in
                guard let self else { return }
                branchPrompt = .create(startPoint: currentBranch)
            },
        ]
    }

    /// The commit composer's actions, at the root beside Switch branch…
    /// rather than down in the Git list: they are the chords the TUI
    /// shares, and the list ⌘K lands on is where a chord is looked up. A
    /// message can be drafted from anywhere (see `generateCommitMessage`);
    /// committing takes the composer, with its ticked files.
    private var commitCommands: [PaletteCommand] {
        let draft = PaletteCommand(
            id: "commit-draft-message", label: "Generate commit message", group: "Git", symbol: "sparkles",
            keywords: "draft write claude codex agent ai", hint: "⌃G"
        ) { [weak self] in self?.generateCommitMessage() }
        guard hasCommitComposer else { return [draft] }
        let changed = rootsWithCommitChanges
        return [
            draft,
            PaletteCommand(
                id: "commit-commit", label: "Commit", group: "Git", symbol: "checkmark.circle",
                keywords: "save changes", hint: "⇧⌘K",
                choices: repositoryChoices(in: changed, all: { [weak self] in self?.ask(commitComposer: .commit) }) {
                    [weak self] root in self?.ask(commitComposer: .commit, only: root.path)
                }
            ) { [weak self] in self?.ask(commitComposer: .commit) },
            PaletteCommand(
                id: "commit-commit-push", label: "Commit and push", group: "Git", symbol: "arrow.up.circle",
                keywords: "save changes upload remote", hint: "⌥⌘K",
                choices: repositoryChoices(in: changed, all: { [weak self] in self?.ask(commitComposer: .commitAndPush) }) {
                    [weak self] root in self?.ask(commitComposer: .commitAndPush, only: root.path)
                }
            ) { [weak self] in self?.ask(commitComposer: .commitAndPush) },
        ]
    }

    /// The repositories the commit composer lists changes of.
    private var rootsWithCommitChanges: [RootModel] {
        let changed = Set((sidebar.workspaceCommit?.changes ?? []).compactMap { sidebar.locate($0.path)?.root })
        return roots.filter { changed.contains($0.path) }
    }

    /// Where a workspace of several asks which repository a command is
    /// for: all of them first — what the command does when nothing is
    /// asked of one — then each by name, under its avatar. Nil while
    /// there is only one to ask about, and the command simply runs.
    private func repositoryChoices(
        in candidates: [RootModel], all: (@MainActor () -> Void)? = nil, each: @escaping @MainActor (RootModel) -> Void
    ) -> [PaletteCommand]? {
        guard roots.count > 1, !candidates.isEmpty else { return nil }
        let everyOne: @MainActor () -> Void = all ?? { candidates.forEach(each) }
        let allRow = PaletteCommand(
            id: "repositories-all", label: "All repositories", group: "Repository", symbol: "square.stack.3d.up",
            run: everyOne)
        let rows = candidates.map { root in
            PaletteCommand(
                id: "repository:\(root.path)", label: root.name, group: "Repository", symbol: "folder",
                monogram: root.name, hint: root.branch
            ) { each(root) }
        }
        return candidates.count > 1 ? [allRow] + rows : rows
    }

    /// The window's own: the diff style is the page's preference, asked
    /// for over the bridge; the pane, its surfaces and the sidebar are the
    /// shell's.
    private var viewCommands: [PaletteCommand] {
        var commands = [
            PaletteCommand(
                id: "view-diff-style", label: "Toggle diff style", group: "View", symbol: "rectangle.split.2x1",
                keywords: "split unified side by side inline"
            ) { [weak self] in self?.page.send(ViewAction.toggleDiffStyle) },
            PaletteCommand(
                id: "view-bottom-pane", label: bottomExpanded ? "Hide bottom pane" : "Show bottom pane",
                group: "View", symbol: "rectangle.bottomthird.inset.filled",
                keywords: "branches history terminal run toggle panel", hint: "⌘B"
            ) { [weak self] in self?.toggleBottomPane() },
        ]
        commands += BottomPaneTab.allCases.map { tab in
            PaletteCommand(
                id: "view-\(tab.rawValue)", label: "Open \(tab.title)", group: "View", symbol: tab.symbol,
                keywords: Self.paneKeywords[tab] ?? "", hint: tab.railShortcut.hint
            ) { [weak self] in self?.show(bottomTab: tab) }
        }
        // Asked a turn later: the palette closes as the row runs, and the
        // update that takes it away re-applies the column binding — still
        // `.all` until the split reports back — undoing the collapse the
        // split had only just begun.
        commands.append(
            PaletteCommand(
                id: "view-sidebar", label: sidebarShown ? "Hide sidebar" : "Show sidebar", group: "View",
                symbol: "sidebar.leading", keywords: "tree files toggle", hint: "⌃⌘S"
            ) { [weak self] in DispatchQueue.main.async { self?.toggleSidebar() } })
        return commands
    }

    private static let paneKeywords: [BottomPaneTab: String] = [
        .branches: "git checkout switch",
        .history: "log commits",
        .terminal: "shell session cli threads",
        .run: "local dev commands services configurations",
    ]

    private var projectCommands: [PaletteCommand] {
        var commands = [
            PaletteCommand(
                id: "project-open", label: "Open workspace…", group: "Project", symbol: "folder",
                keywords: "open change repository folder picker switch workspace project", hint: "⌘O"
            ) { [weak self] in self?.showOpener() },
            PaletteCommand(
                id: "project-add-root", label: "Add repository to workspace…", group: "Project",
                symbol: "plus.square.on.square", keywords: "add repository root workspace multi folder", hint: "⌥⌘O"
            ) { [weak self] in self?.chooseRootToAdd() },
        ]
        if workspace?.workspace == nil {
            commands.append(PaletteCommand(
                id: "project-save-workspace", label: "Save as workspace…", group: "Project",
                symbol: "plus.square.on.square", keywords: "save keep workspace name repositories"
            ) { [weak self] in self?.askToSaveWorkspace() })
        }
        // Each repository of the workspace, to turn the page to.
        for root in roots.count > 1 ? roots : [] where root !== focusedRoot {
            commands.append(PaletteCommand(
                id: "project-focus-\(root.path)", label: "Go to repository \(root.name)", group: "Project",
                symbol: "folder", monogram: root.name, keywords: "switch repository root focus \(root.name)"
            ) { [weak self] in self?.focus(root: root) })
        }
        return commands
    }

    private var sessionCommands: [PaletteCommand] {
        [
            PaletteCommand(
                id: "session-new", label: "New agent session", group: "Sessions", symbol: "paperplane",
                keywords: "chat agent claude codex", hint: "⌘T"
            ) { [weak self] in self?.newSession() }
        ]
    }

    /// The branches to offer for checkout: the one you are on first, then
    /// the rest of the local branches, then the remote branches that have
    /// no local counterpart — a remote you already track is the same
    /// branch twice.
    func paletteBranches() -> [PaletteBranch] {
        let tracked = Set(branches.map(\.name))
        let local = (branches.filter(\.isCurrent) + branches.filter { !$0.isCurrent })
            .map { branch in
                PaletteBranch(
                    name: branch.name, ref: branch.name, group: "Local", isCurrent: branch.isCurrent,
                    hint: branch.isCurrent ? "current" : Self.trackingHint(branch))
            }
        let remote = remoteBranches
            .filter { !tracked.contains($0.shortName) }
            .map { branch in
                PaletteBranch(name: branch.name, ref: branch.shortName, group: "Remote", isCurrent: false, hint: branch.remote)
            }
        return local + remote
    }

    private static func trackingHint(_ branch: BranchInfo) -> String? {
        let counts = [branch.ahead > 0 ? "↑\(branch.ahead)" : "", branch.behind > 0 ? "↓\(branch.behind)" : ""]
            .filter { !$0.isEmpty }
        return counts.isEmpty ? nil : counts.joined(separator: " ")
    }
}
