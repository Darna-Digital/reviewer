// The file tree the code island reports — see `ShellTree` in the SPA's
// `lib/shell` — and the native sidebar's own state over it: which folds are
// open, what the search field holds, which row is selected. The listing and
// what may be done to it are the page's; a fold, a search and the selection
// are the sidebar's, the way they would be an outline view's. What goes back
// is each thing the native tree was asked to do — see `TreeAction`.
import Foundation
import Observation

enum TreeMode: String, Decodable, Sendable {
    case browse, commit, review
}

struct ShellTree: Decodable, Equatable, Sendable {
    let mode: TreeMode
    let paths: [String]
    let gitStatus: [GitStatusEntry]
    let loading: Bool
    let projectPath: String?
    let discardable: Bool

    static func decode(_ body: Any?) -> ShellTree? { Wire.decode(body) }
}

struct ShellTreeState: Decodable, Sendable {
    let selected: String?
    let commit: ShellCommitComposer?
    let comparison: ShellComparison?

    static func decode(_ body: Any?) -> ShellTreeState? { Wire.decode(body) }
}

/// What your own changes are read against — `LocalComparison` in core,
/// flattened: the branch, or nil for what is merely uncommitted — and where
/// the branch's work is aimed, which the picker marks as the web one does.
struct ShellComparison: Decodable, Equatable, Sendable {
    let against: String?
    let aim: String?
}

struct ShellCommitComposer: Decodable, Hashable, Sendable {
    let changes: [GitStatusEntry]
    let draft: CommitDraft?
}

/// The server's drafting run — `CommitDraft` in core.
struct CommitDraft: Decodable, Hashable, Sendable {
    enum Status: String, Decodable, Sendable {
        case idle, running, ready, error
    }

    let status: Status
    let message: String?
    let error: String?
}

/// Agent CLIs that can draft a commit message — `CommitAgent` in the SPA.
enum CommitAgent: String, CaseIterable, Identifiable, Sendable {
    case claude, codex, opencode, cursor

    var id: Self { self }

    var label: String {
        switch self {
        case .claude: return "Claude"
        case .codex: return "Codex"
        case .opencode: return "OpenCode"
        case .cursor: return "Cursor"
        }
    }

    var provider: ChatProviderKind {
        switch self {
        case .claude: return .claude
        case .codex: return .codex
        case .opencode: return .opencode
        case .cursor: return .cursor
        }
    }
}

/// The tree's actions, in the shape the island's `ShellTreeAction` takes.
enum TreeAction {
    case select(String)
    /// A file is about to be opened — the pointer has reached its row, or
    /// the palette has it lit — so the page reads and highlights it ahead
    /// of the click or the Return that may follow.
    case intent(String)
    case history(String)
    /// Carried out by the shell itself against the server, never sent to
    /// the page — see `AppModel.act(onTree:)`.
    case discard([String])
    case commit(message: String, paths: [String], push: Bool)
    case draft(paths: [String], agent: CommitAgent)
    case draftSettled

    var payload: [String: Any] {
        switch self {
        case .select(let path): return ["kind": "select", "path": path]
        case .intent(let path): return ["kind": "intent", "path": path]
        case .history(let path): return ["kind": "history", "path": path]
        case .discard(let paths): return ["kind": "discard", "paths": paths]
        case .commit(let message, let paths, let push):
            return ["kind": "commit", "message": message, "paths": paths, "push": push]
        case .draft(let paths, let agent): return ["kind": "draft", "paths": paths, "agent": agent.rawValue]
        case .draftSettled: return ["kind": "draftSettled"]
        }
    }
}

/// From a message body as WebKit hands it over. Anything but a dictionary —
/// the `null` a page with no tree sends arrives as `NSNull` — is nothing:
/// `JSONSerialization` raises an Objective-C exception on a non-container
/// rather than throwing, and one of those inside a task on the main actor
/// leaves the concurrency runtime's executor tracking stale, which WebKit's
/// next isolation check then crashes on.
enum Wire {
    static func decode<T: Decodable>(_ body: Any?) -> T? {
        guard let object = body as? [String: Any],
            let data = try? JSONSerialization.data(withJSONObject: object)
        else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    /// The server's timestamps — ISO 8601, with the fraction JavaScript's
    /// `toISOString` writes, or without one.
    static func date(_ iso: String) -> Date? {
        let fractional = Date.ISO8601FormatStyle(includingFractionalSeconds: true)
        return (try? fractional.parse(iso)) ?? (try? Date.ISO8601FormatStyle().parse(iso))
    }
}

/// One repository of the workspace as the tree stands it under a header:
/// its own listing, read by the shell from the server — what the tree shows
/// under it while the page is on another repository. The focused root's
/// rows are the page's report instead, with everything the page knows that
/// a plain listing does not — the comparison, the commented files.
struct TreeRoot: Equatable, Sendable {
    let path: String
    let name: String
    let branch: String?
    let paths: [String]
    let gitStatus: [GitStatusEntry]

    /// The files a diff of its own changes lists: everything git calls
    /// changed, the ignored aside.
    var changedPaths: [String] {
        gitStatus.filter { $0.status != .ignored }.map(\.path)
    }
}

@MainActor
@Observable
final class SidebarTree {
    private(set) var listing: ShellTree?
    /// The workspace's repositories in its order, while it holds more than
    /// one — each the header of its own part of the tree.
    private(set) var workspaceRoots: [TreeRoot] = []
    /// The repository the page is on.
    private(set) var focusedRootPath: String?
    /// Each root's key — the first component of every id under its header
    /// — by its path: the folder's name, numbered from the second root that
    /// shares one.
    private var keys: [String: String] = [:]
    /// The root of each key, the way back from a row to its repository.
    private var rootsByKey: [String: TreeRoot] = [:]
    private(set) var selected: String?
    private(set) var commit: ShellCommitComposer?
    /// The comparison the changed files are read against, while they are
    /// your own — the compare picker's answer.
    private(set) var comparison: ShellComparison?
    private(set) var roots: [FileTreeNode] = []
    private(set) var nodes: [String: FileTreeNode] = [:]
    private(set) var statusByPath: [String: GitFileStatus] = [:]
    /// Every folder with a changed file somewhere under it, which the row
    /// marks with a dot the way the web tree does.
    private(set) var foldersWithChanges: Set<String> = []
    private(set) var ignoredFolders: Set<String> = []

    /// The tree the outline shows: the listing's, or under a search the
    /// files the search keeps with the folders on the way to them.
    private(set) var shown: [FileTreeNode] = []
    private(set) var shownNodes: [String: FileTreeNode] = [:]
    /// Bumped whenever `shown` is a different tree, or its folds start over
    /// — what the outline reloads on.
    private(set) var treeVersion = 0
    /// Bumped when the tree is remade wholesale — another mode's, another
    /// project's — rather than the same one refiltered or restatused: what
    /// the outline crossfades on, a reload from one tree's rows to another's
    /// being nothing an outline can animate row by row.
    private(set) var remadeVersion = 0
    /// Bumped whenever a row's status may have changed — what the outline
    /// redraws its visible rows on.
    private(set) var statusVersion = 0

    /// The search over the changed files — the diff layouts have one, the
    /// project tree does not, as in the web app.
    var query = "" {
        didSet { if query != oldValue { refilter() } }
    }

    /// Set to hand the keyboard to the search over the changed files — ⌘F
    /// over a diff (see `AppModel.find`) — and cleared by the field that
    /// takes it. A flag rather than a call, since the field may not be in
    /// the window yet: the sidebar put away, the pull request's files on
    /// their way in. Whichever field stands up first answers it.
    var filterWantsKeyboard = false

    /// The folds that differ from the mode's default — closed for the
    /// project, open for a diff — so a fresh listing keeps how each was left.
    private var toggled: Set<String> = []
    private var foldsKey: String?

    var mode: TreeMode? { listing?.mode }
    /// Whether the outline has no rows: none listed, or none yet.
    var isEmpty: Bool { roots.isEmpty }
    /// Whether rows are still on their way: the page is loading them, or
    /// has not reported a tree at all since it last took one down.
    var isLoading: Bool { listing?.loading ?? true }
    var isSearching: Bool { !query.trimmingCharacters(in: .whitespaces).isEmpty }

    /// The web tree opens a diff's few files and closes the project's many.
    private var opensByDefault: Bool { listing?.mode != .browse }

    /// Whether a folder's row shows its children: every one while a search
    /// is on, otherwise as it was left.
    func isExpanded(_ path: String) -> Bool {
        if isSearching { return true }
        // A repository's header opens on its top level, whatever the mode.
        let opens = isRootHeader(path) || opensByDefault
        return opens != toggled.contains(path)
    }

    func status(of path: String) -> GitFileStatus? {
        if let own = statusByPath[path] { return own }
        return FileTree.ancestors(of: path).contains { ignoredFolders.contains($0) } ? .ignored : nil
    }

    /// The changed files under a folder — what a discard of the folder is.
    func changedFiles(under folder: String) -> [String] {
        statusByPath.filter { $0.key.hasPrefix(folder + "/") && $0.value != .ignored }.map(\.key).sorted()
    }

    // MARK: reports

    /// The tree as the page reports it. A page that shows no tree takes the
    /// listing down and leaves the rows standing: the sidebar is crossfading
    /// to another layout over them (see `SidebarLayout`), and rows cleared
    /// under a fading outline vanish before it does; the next tree reported
    /// replaces them, remade if it is another mode's or project's.
    func take(_ listing: ShellTree?) {
        guard listing != self.listing else { return }
        self.listing = listing
        guard let listing else { return }
        // The composer and the comparison are the commit view's; on any
        // other surface they are gone with the listing, not a state report
        // later, so the sidebar leaves them in one move with the tree.
        if listing.mode != .commit {
            commit = nil
            comparison = nil
        }
        rebuild()
    }

    func take(_ state: ShellTreeState) {
        // The state comes with every selection too, and an observed property
        // written notifies whether or not it changed: the composer would
        // redraw its whole file list on each pick.
        if commit != state.commit { commit = state.commit }
        if comparison != state.comparison { comparison = state.comparison }
        pageSelected = state.selected
        let selected = state.selected.map { id(of: $0, in: pageRootPath) }
        guard selected != self.selected else { return }
        self.selected = selected
        reveal(selected)
    }

    // MARK: workspace

    /// The workspace's repositories as they now stand — their listings
    /// read again, one opened or closed. One repository on its own is no
    /// workspace to stand under headers: its tree is the page's alone.
    func take(roots: [TreeRoot]) {
        let roots = roots.count > 1 ? roots : []
        guard roots != workspaceRoots else { return }
        workspaceRoots = roots
        keys = Self.rootKeys(for: roots)
        rootsByKey = Dictionary(uniqueKeysWithValues: roots.compactMap { root in keys[root.path].map { ($0, root) } })
        rebuild()
    }

    /// The page moved to another repository of the workspace: its rows are
    /// the page's report from now on, and the selection the page's there.
    func focusChanged(to path: String?) {
        guard path != focusedRootPath else { return }
        focusedRootPath = path
        rebuild()
    }

    /// The repository the page's report is of — the one it names, which
    /// for a moment after a move is still the repository the page left;
    /// until the page reports the new one, that one's rows are its own
    /// listing rather than the old repository's under its header.
    private var pageRootPath: String? { listing?.projectPath ?? focusedRootPath }

    /// Whether the tree stands each of the workspace's repositories under a
    /// header of its own. A pull request's files are its repository's
    /// alone, and stand beside the diff rather than in the sidebar.
    var isMultiRoot: Bool { !workspaceRoots.isEmpty && listing?.mode != .review }

    /// The row's repository and its path inside it — what the page and the
    /// server are told, a row's id being namespaced by its root's key while
    /// the tree holds more than one. A root's own header is its repository
    /// with an empty path.
    func locate(_ id: String) -> (root: String, path: String)? {
        guard isMultiRoot else { return (focusedRootPath ?? listing?.projectPath).map { ($0, id) } }
        let key = id.prefix { $0 != "/" }
        guard let root = rootsByKey[String(key)] else { return nil }
        return (root.path, String(id.dropFirst(key.count).drop { $0 == "/" }))
    }

    /// The id a repository's path has in the tree.
    func id(of path: String, in root: String?) -> String {
        guard isMultiRoot, let root, let key = keys[root] else { return path }
        return path.isEmpty ? key : "\(key)/\(path)"
    }

    /// Whether a row is a repository's header.
    func isRootHeader(_ id: String) -> Bool {
        isMultiRoot && rootsByKey[id] != nil
    }

    /// The commit composer's changes across the workspace: the page's own,
    /// for the repository it is on, and every other repository's changed
    /// files beside them, each under its root's key — so one commit can
    /// take files of several repositories, a commit in each (see
    /// `AppModel.commit`). The draft is the page's, of its repository.
    ///
    /// The page reports no composer while its own repository is clean, so
    /// across a workspace the composer stands on the changes alone: over
    /// your uncommitted changes, it is up while any repository has some,
    /// whichever one the page is on.
    var workspaceCommit: ShellCommitComposer? {
        guard isMultiRoot else { return commit }
        guard listing?.mode == .commit, comparison?.against == nil else { return nil }
        let changes = workspaceRoots.flatMap { root -> [GitStatusEntry] in
            let entries = root.path == pageRootPath
                ? commit?.changes ?? []
                : root.gitStatus.filter { $0.status != .ignored }
            return entries.map { GitStatusEntry(path: id(of: $0.path, in: root.path), status: $0.status) }
        }
        guard !changes.isEmpty else { return nil }
        return ShellCommitComposer(changes: changes, draft: commit?.draft)
    }

    /// The selection the page last reported, in its own repository's terms.
    private var pageSelected: String?

    /// Each repository's key by its path — what the tree and the palette
    /// name its files under.
    static func rootKeys(for roots: [TreeRoot]) -> [String: String] {
        var taken: [String: Int] = [:]
        var keys: [String: String] = [:]
        for root in roots {
            let seen = taken[root.name, default: 0] + 1
            taken[root.name] = seen
            keys[root.path] = seen == 1 ? root.name : "\(root.name) \(seen)"
        }
        return keys
    }

    /// Each repository's rows and statuses: the page's for the one it is
    /// on, the repository's own listing for the rest — all of its files on
    /// the browse page, only its changed ones over a diff. Over a diff a
    /// repository with nothing changed stands no header, the way a
    /// JetBrains commit view lists only the roots that have something to
    /// commit; with none, the tree is empty and says so.
    private func workspaceListings(_ listing: ShellTree) -> [(root: TreeRoot, paths: [String], status: [GitStatusEntry])] {
        let listings = workspaceRoots.map { root in
            if root.path == pageRootPath { return (root: root, paths: listing.paths, status: listing.gitStatus) }
            return (root: root, paths: listing.mode == .browse ? root.paths : root.changedPaths, status: root.gitStatus)
        }
        return listing.mode == .browse ? listings : listings.filter { !$0.paths.isEmpty }
    }

    /// The tree remade from what it now stands on, wherever that changed.
    /// The workspace's headers are repositories, its folds kept across a
    /// move between them; a plain tree is remade per mode and per project,
    /// and its folds start over with it, as the web tree's do.
    private func rebuild() {
        guard let listing else { return }
        let built: [FileTreeNode]
        let statuses: [GitStatusEntry]
        let signature: [String]
        if isMultiRoot {
            let listings = workspaceListings(listing)
            signature = listings.flatMap { entry in
                [">\(entry.root.path)", entry.root.branch ?? ""] + entry.paths
            }
            built = listings.map { entry in
                let key = keys[entry.root.path] ?? entry.root.name
                return FileTreeNode(
                    id: key, name: entry.root.name, isDirectory: true,
                    children: FileTree.build(paths: entry.paths, prefix: key), root: entry.root)
            }
            statuses = listings.flatMap { entry in
                entry.status.map { GitStatusEntry(path: id(of: $0.path, in: entry.root.path), status: $0.status) }
            }
        } else {
            signature = listing.paths
            built = []
            statuses = listing.gitStatus
        }
        var changed = false
        if signature != builtSignature {
            builtSignature = signature
            roots = isMultiRoot ? built : FileTree.build(paths: listing.paths)
            nodes = FileTree.index(roots)
            changed = true
        }
        if statuses != indexedStatuses {
            indexedStatuses = statuses
            index(statuses)
        }
        let key = isMultiRoot
            ? "\(listing.mode.rawValue):workspace:\(workspaceRoots.map(\.path).joined(separator: "\n"))"
            : "\(listing.mode.rawValue):\(listing.projectPath ?? "")"
        if key != foldsKey {
            foldsKey = key
            toggled = []
            query = ""
            reveal(selected)
            remadeVersion += 1
            changed = true
        }
        if changed { refilter() }
    }

    /// What the tree was last built from and its statuses indexed from —
    /// what a fresh report is measured against.
    private var builtSignature: [String]?
    private var indexedStatuses: [GitStatusEntry]?

    private func index(_ entries: [GitStatusEntry]) {
        var byPath: [String: GitFileStatus] = [:]
        var changed: Set<String> = []
        var ignored: Set<String> = []
        for entry in entries {
            let path = entry.path.hasSuffix("/") ? String(entry.path.dropLast()) : entry.path
            byPath[path] = entry.status
            if entry.status == .ignored {
                ignored.insert(path)
            } else {
                changed.formUnion(FileTree.ancestors(of: path))
            }
        }
        statusByPath = byPath
        foldersWithChanges = changed
        ignoredFolders = ignored
        statusVersion += 1
    }

    private func refilter() {
        shown = isSearching ? FileTree.filter(roots, matching: query) : roots
        shownNodes = isSearching ? FileTree.index(shown) : nodes
        treeVersion += 1
    }

    // MARK: folds

    func toggle(_ path: String) {
        if toggled.contains(path) { toggled.remove(path) } else { toggled.insert(path) }
    }

    func setExpanded(_ path: String, _ expanded: Bool) {
        if isExpanded(path) != expanded { toggle(path) }
    }

    /// Opens every fold on the way to a path, so a file the page moved to is
    /// on screen.
    func reveal(_ path: String?) {
        guard let path else { return }
        for ancestor in FileTree.ancestors(of: path) where nodes[ancestor] != nil {
            setExpanded(ancestor, true)
        }
    }
}
