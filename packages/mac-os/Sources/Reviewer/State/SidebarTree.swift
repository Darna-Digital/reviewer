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
    let editable: Bool
    let discardable: Bool

    static func decode(_ body: Any?) -> ShellTree? { Wire.decode(body) }
}

struct ShellTreeState: Decodable, Sendable {
    let selected: String?
    let commit: ShellCommitComposer?

    static func decode(_ body: Any?) -> ShellTreeState? { Wire.decode(body) }
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
}

/// A row's kind and path, as the page's file actions take them.
struct TreeItem: Hashable, Sendable {
    enum Kind: String, Sendable {
        case file, directory
    }

    let kind: Kind
    let path: String

    var payload: [String: Any] { ["kind": kind.rawValue, "path": path] }
}

/// The tree's actions, in the shape the island's `ShellTreeAction` takes.
enum TreeAction {
    case select(String)
    case history(String)
    case discard([String])
    case delete([TreeItem])
    case rename(from: String, to: String)
    case create(path: String, entry: TreeItem.Kind)
    case commit(message: String, paths: [String], push: Bool)
    case draft(paths: [String], agent: CommitAgent)
    case draftSettled

    var payload: [String: Any] {
        switch self {
        case .select(let path): return ["kind": "select", "path": path]
        case .history(let path): return ["kind": "history", "path": path]
        case .discard(let paths): return ["kind": "discard", "paths": paths]
        case .delete(let items): return ["kind": "delete", "items": items.map(\.payload)]
        case .rename(let from, let to): return ["kind": "rename", "from": from, "to": to]
        case .create(let path, let entry): return ["kind": "create", "path": path, "entry": entry.rawValue]
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

@MainActor
@Observable
final class SidebarTree {
    private(set) var listing: ShellTree?
    private(set) var selected: String?
    private(set) var commit: ShellCommitComposer?
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
    /// Bumped whenever a row's status may have changed — what the outline
    /// redraws its visible rows on.
    private(set) var statusVersion = 0

    /// The search over the changed files — the diff layouts have one, the
    /// project tree does not, as in the web app.
    var query = "" {
        didSet { if query != oldValue { refilter() } }
    }

    /// The folds that differ from the mode's default — closed for the
    /// project, open for a diff — so a fresh listing keeps how each was left.
    private var toggled: Set<String> = []
    private var foldsKey: String?

    var mode: TreeMode? { listing?.mode }
    var isEmpty: Bool { listing?.paths.isEmpty ?? true }
    var isSearching: Bool { !query.trimmingCharacters(in: .whitespaces).isEmpty }

    /// The web tree opens a diff's few files and closes the project's many.
    private var opensByDefault: Bool { listing?.mode != .browse }

    /// Whether a folder's row shows its children: every one while a search
    /// is on, otherwise as it was left.
    func isExpanded(_ path: String) -> Bool {
        isSearching || opensByDefault != toggled.contains(path)
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

    func take(_ listing: ShellTree?) {
        let previous = self.listing
        guard listing != previous else { return }
        self.listing = listing
        guard let listing else {
            roots = []
            nodes = [:]
            statusByPath = [:]
            foldersWithChanges = []
            ignoredFolders = []
            commit = nil
            refilter()
            return
        }
        var changed = false
        if previous?.paths != listing.paths {
            roots = FileTree.build(paths: listing.paths)
            nodes = FileTree.index(roots)
            changed = true
        }
        if previous?.gitStatus != listing.gitStatus {
            index(listing.gitStatus)
        }
        // The web tree is remade per mode and per project, and its folds
        // start over with it.
        let key = "\(listing.mode.rawValue):\(listing.projectPath ?? "")"
        if key != foldsKey {
            foldsKey = key
            toggled = []
            query = ""
            reveal(selected)
            changed = true
        }
        if changed { refilter() }
    }

    func take(_ state: ShellTreeState) {
        commit = state.commit
        guard state.selected != selected else { return }
        selected = state.selected
        reveal(state.selected)
    }

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
