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
        navigationCommands + gitCommands + viewCommands + projectCommands + sessionCommands
    }

    private var navigationCommands: [PaletteCommand] {
        [
            PaletteCommand(
                id: "go-review", label: "Go to Review", group: "Navigation", symbol: CodeSurface.review.symbol,
                keywords: "commit working tree changes diff local", hint: CodeSurface.review.railShortcut.hint
            ) { [weak self] in self?.show(surface: .review) },
            PaletteCommand(
                id: "go-reviews", label: "Go to Merge requests", group: "Navigation",
                symbol: CodeSurface.reviews.symbol, keywords: "merge request mr review pr github pull requests",
                hint: CodeSurface.reviews.railShortcut.hint
            ) { [weak self] in self?.show(surface: .reviews) },
            PaletteCommand(
                id: "go-browse", label: "Browse the Project", group: "Navigation", symbol: CodeSurface.browse.symbol,
                keywords: "files history commits explore", hint: CodeSurface.browse.railShortcut.hint
            ) { [weak self] in self?.show(surface: .browse) },
            PaletteCommand(
                id: "go-settings", label: "Open Settings", group: "Navigation", symbol: "gearshape",
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
                submenu: .git
            ) { [weak self] in self?.fetch() },
            PaletteCommand(
                id: "git-pull", label: "Pull", group: "Git", symbol: "arrow.down", keywords: "remote update",
                submenu: .git
            ) { [weak self] in self?.pull() },
            PaletteCommand(
                id: "git-push", label: "Push", group: "Git", symbol: "arrow.up", keywords: "remote upload",
                submenu: .git
            ) { [weak self] in self?.push() },
            PaletteCommand(
                id: "git-branch", label: "Create Branch…", group: "Git", symbol: "arrow.triangle.branch",
                keywords: "new checkout", submenu: .git
            ) { [weak self] in
                guard let self else { return }
                branchPrompt = .create(startPoint: currentBranch)
            },
        ]
    }

    /// The window's own: the diff style is the page's preference, asked
    /// for over the bridge; the pane, its surfaces and the sidebar are the
    /// shell's.
    private var viewCommands: [PaletteCommand] {
        var commands = [
            PaletteCommand(
                id: "view-diff-style", label: "Toggle Diff Style", group: "View", symbol: "rectangle.split.2x1",
                keywords: "split unified side by side inline"
            ) { [weak self] in self?.page.send(ViewAction.toggleDiffStyle) },
            PaletteCommand(
                id: "view-bottom-pane", label: bottomExpanded ? "Hide Bottom Pane" : "Show Bottom Pane",
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
        commands.append(
            PaletteCommand(
                id: "view-sidebar", label: sidebarShown ? "Hide Sidebar" : "Show Sidebar", group: "View",
                symbol: "sidebar.leading", keywords: "tree files toggle", hint: "⌃⌘S"
            ) { [weak self] in self?.toggleSidebar() })
        return commands
    }

    private static let paneKeywords: [BottomPaneTab: String] = [
        .branches: "git checkout switch",
        .history: "log commits",
        .terminal: "shell session cli threads",
        .run: "local dev commands services configurations",
    ]

    private var projectCommands: [PaletteCommand] {
        [
            PaletteCommand(
                id: "project-open", label: "Open Repository…", group: "Project", symbol: "folder",
                keywords: "open change repository folder picker switch", hint: "⌘O"
            ) { [weak self] in self?.showOpener() }
        ]
    }

    private var sessionCommands: [PaletteCommand] {
        [
            PaletteCommand(
                id: "session-new", label: "New Agent Session", group: "Sessions", symbol: "paperplane",
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
