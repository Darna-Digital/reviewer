// The branch picker's half of the model: the branches of the current root,
// and the git actions the picker offers on any of them — the same set the
// web app's switcher has, run through the server. Every action re-reads the
// project afterwards and tells the islands to, since the diff, the tree and
// the history all change under a checkout or a merge — and every one is a
// notice for its whole run (see `Notices`): the attempt while it is made,
// then git's own word on it, or the reason it was refused.
import Foundation

/// A branch the picker can act on: local or remote, by ref and by the name
/// it is shown under.
struct BranchRef: Hashable, Sendable {
    let ref: String
    let display: String
    let isCurrent: Bool
    let isRemote: Bool

    init(_ branch: BranchInfo) {
        ref = branch.name
        display = branch.name
        isCurrent = branch.isCurrent
        isRemote = false
    }

    init(_ branch: RemoteBranchInfo) {
        ref = branch.name
        display = branch.name
        isCurrent = false
        isRemote = true
    }
}

/// Branches under the folder their names share — `feature/x` and
/// `feature/y` under `feature` — the way the switcher folds them.
struct BranchFolder {
    let name: String?
    let items: [BranchRef]
}

extension BranchRef {
    /// The part of the name before its first slash, when it has one.
    var folder: String? {
        display.contains("/") ? String(display.prefix { $0 != "/" }) : nil
    }

    /// The name with its folder taken off, for a row already under it.
    var leaf: String {
        folder == nil ? display : String(display.drop { $0 != "/" }.dropFirst())
    }
}

extension Array where Element == BranchRef {
    /// Folded by folder, in the order the server listed them.
    func groupedByFolder() -> [BranchFolder] {
        var order: [String?] = []
        var grouped: [String?: [BranchRef]] = [:]
        for branch in self {
            let folder = branch.folder
            if grouped[folder] == nil { order.append(folder) }
            grouped[folder, default: []].append(branch)
        }
        return order.map { BranchFolder(name: $0, items: grouped[$0] ?? []) }
    }
}

/// What the picker asks before it acts: a name for a branch, a new name, or
/// a yes to a deletion — in the repository at `root`'s path, when it was
/// asked over one of a workspace's, or the focused one.
enum BranchPrompt: Identifiable, Equatable {
    case create(startPoint: String?, root: String? = nil)
    case rename(from: String, root: String? = nil)
    case delete(name: String, root: String? = nil)

    var id: String {
        switch self {
        case .create(let start, let root): return "create:\(root ?? ""):\(start ?? "")"
        case .rename(let from, let root): return "rename:\(root ?? ""):\(from)"
        case .delete(let name, let root): return "delete:\(root ?? ""):\(name)"
        }
    }

    var root: String? {
        switch self {
        case .create(_, let root), .rename(_, let root), .delete(_, let root): return root
        }
    }
}

extension AppModel {
    var currentBranch: String? { status?.branch }

    /// The few most recently committed to, the way the switcher's Recent
    /// section reads them — the server lists branches newest first.
    var recentBranches: [BranchInfo] { Array(branches.prefix(5)) }

    func loadBranches() async {
        await focused.loadBranches()
    }

    // MARK: actions

    // Each action runs in `root` when one is named — a repository of a
    // workspace picked in the switcher, whichever one the page is on — and
    // in the focused root otherwise.

    func checkout(_ branch: String, in root: RootModel? = nil) {
        let at = naming(root)
        runGit(in: root, "Checking out \(branch)\(at)…", done: "Checked out \(branch)\(at)", failed: "Checkout\(at) failed") {
            try await $0.checkout(branch: branch)
            return nil
        }
    }

    func checkoutAndUpdate(_ branch: String, in root: RootModel? = nil) {
        let at = naming(root)
        runGit(in: root, "Checking out \(branch)\(at)…", done: "Checked out and updated \(branch)\(at)",
               failed: "Checkout\(at) failed") {
            try await $0.checkout(branch: branch)
            return try await $0.pull()
        }
    }

    func fetch(in root: RootModel? = nil) {
        let at = naming(root)
        runGit(in: root, "Fetching\(at)…", done: "Fetched\(at)", failed: "Fetch\(at) failed") { try await $0.fetch() }
    }

    func pull(in root: RootModel? = nil) {
        let at = naming(root)
        runGit(in: root, "Pulling\(at)…", done: "Pulled\(at)", failed: "Pull\(at) failed") { try await $0.pull() }
    }

    func push(in root: RootModel? = nil) {
        let at = naming(root)
        runGit(in: root, "Pushing\(at)…", done: "Pushed\(at)", failed: "Push\(at) failed") { try await $0.push() }
    }

    func merge(_ branch: String, in root: RootModel? = nil) {
        let at = naming(root)
        runGit(in: root, "Merging \(branch)\(at)…", done: "Merged \(branch)\(at)", failed: "Merge of \(branch)\(at) stopped") {
            try await $0.merge(branch: branch)
        }
    }

    func rebase(onto branch: String, in root: RootModel? = nil) {
        let at = naming(root)
        runGit(in: root, "Rebasing onto \(branch)\(at)…", done: "Rebased onto \(branch)\(at)",
               failed: "Rebase onto \(branch)\(at) stopped") {
            try await $0.rebase(onto: branch)
        }
    }

    func createBranch(named name: String, from startPoint: String?, in root: RootModel? = nil) {
        let at = naming(root)
        runGit(in: root, "Creating \(name)\(at)…", done: "Created branch \(name)\(at)", failed: "Could not create \(name)\(at)") {
            try await $0.createBranch(name: name, startPoint: startPoint)
            return nil
        }
    }

    func renameBranch(_ from: String, to: String, in root: RootModel? = nil) {
        let at = naming(root)
        runGit(in: root, "Renaming \(from)\(at)…", done: "Renamed \(from) → \(to)\(at)", failed: "Could not rename \(from)\(at)") {
            try await $0.renameBranch(from: from, to: to)
            return nil
        }
    }

    func deleteBranch(_ name: String, in root: RootModel? = nil) {
        let at = naming(root)
        runGit(in: root, "Deleting \(name)\(at)…", done: "Deleted \(name)\(at)", failed: "Could not delete \(name)\(at)") {
            try await $0.deleteBranch(name: name)
            return nil
        }
    }

    /// Two branches side by side, on the Code tab — of `root`, when one is
    /// named, the page turning to it.
    func compare(base: String, head: String, in root: RootModel? = nil) {
        var components = URLComponents()
        components.path = "/modes/code/browse/range"
        components.queryItems = [URLQueryItem(name: "base", value: base), URLQueryItem(name: "head", value: head)]
        showOnCodeTab(components.string ?? Href.review, in: root)
    }

    /// The branch you are on, read against what it is aimed at — everything
    /// since the merge base, uncommitted work included. Aiming is remembered
    /// by the server, so the next read of this branch needs no menu.
    func review(_ head: String, against target: String, in root: RootModel? = nil) {
        Task {
            try? await (root?.client ?? client).setBranchTarget(branch: head, target: target)
            var components = URLComponents()
            components.path = Href.review
            components.queryItems = [URLQueryItem(name: "target", value: target)]
            showOnCodeTab(components.string ?? Href.review, in: root)
        }
    }

    /// Your own changes read against `target` — or against nothing, when
    /// it is nil: only what is uncommitted. The choice lives in the page's
    /// address, as in the web app, so it is something the page can go back
    /// out of; written even when empty, since an absent target would only
    /// let the branch's aim answer again, and this is how you say otherwise.
    func readChanges(against target: String?) {
        var components = URLComponents()
        components.path = Href.review
        components.queryItems = [URLQueryItem(name: "target", value: target ?? "")]
        showOnCodeTab(components.string ?? Href.review)
    }

    /// The action as a notice, `pending` while it runs and then `done` or
    /// `failed` over what git said — and the project re-read either way,
    /// since a merge that stopped on a conflict has changed the tree as
    /// surely as one that went through. Run in a named root, only that one
    /// is read again after.
    private func runGit(
        in root: RootModel?, _ pending: String, done: String, failed: String,
        _ body: @escaping (ReviewerClient) async throws -> String?
    ) {
        Task {
            headMovesInFlight += 1
            defer { headMovesInFlight -= 1 }
            let client = root?.client ?? self.client
            await notices.run(pending, done: done, failed: failed, report: .command) { try await body(client) }
            if let root { await refresh(root: root) } else { await refresh() }
        }
    }

    /// The repository an action names in its notice, when it was aimed at
    /// one of several.
    private func naming(_ root: RootModel?) -> String {
        root.map { " in \($0.name)" } ?? ""
    }

    private func showOnCodeTab(_ href: String, in root: RootModel?) {
        if let root { showOnCodeTab(href, in: root) } else { showOnCodeTab(href) }
    }
}
