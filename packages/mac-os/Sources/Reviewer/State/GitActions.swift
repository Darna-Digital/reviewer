// The branch picker's half of the model: the branches of the current root,
// and the git actions the picker offers on any of them — the same set the
// web app's switcher has, run through the server. Every action re-reads the
// project afterwards and tells the islands to, since the diff, the tree and
// the history all change under a checkout or a merge.
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

/// What the picker asks before it acts: a name for a branch, a new name, or
/// a yes to a deletion.
enum BranchPrompt: Identifiable, Equatable {
    case create(startPoint: String?)
    case rename(from: String)
    case delete(name: String)

    var id: String {
        switch self {
        case .create(let start): return "create:\(start ?? "")"
        case .rename(let from): return "rename:\(from)"
        case .delete(let name): return "delete:\(name)"
        }
    }
}

extension AppModel {
    var currentBranch: String? { status?.branch }

    /// The few most recently committed to, the way the switcher's Recent
    /// section reads them — the server lists branches newest first.
    var recentBranches: [BranchInfo] { Array(branches.prefix(5)) }

    func loadBranches() async {
        async let local = client.branches()
        async let remote = client.remoteBranches()
        branches = (try? await local) ?? []
        remoteBranches = (try? await remote) ?? []
    }

    // MARK: actions

    func checkout(_ branch: String) {
        runGit { try await self.client.checkout(branch: branch) }
    }

    func checkoutAndUpdate(_ branch: String) {
        runGit {
            try await self.client.checkout(branch: branch)
            _ = try await self.client.pull()
        }
    }

    func fetch() {
        runGit { _ = try await self.client.fetch() }
    }

    func push() {
        runGit { _ = try await self.client.push() }
    }

    func merge(_ branch: String) {
        runGit { _ = try await self.client.merge(branch: branch) }
    }

    func rebase(onto branch: String) {
        runGit { _ = try await self.client.rebase(onto: branch) }
    }

    func createBranch(named name: String, from startPoint: String?) {
        runGit { try await self.client.createBranch(name: name, startPoint: startPoint) }
    }

    func renameBranch(_ from: String, to: String) {
        runGit { try await self.client.renameBranch(from: from, to: to) }
    }

    func deleteBranch(_ name: String) {
        runGit { try await self.client.deleteBranch(name: name) }
    }

    /// Two branches side by side, on the Code tab.
    func compare(base: String, head: String) {
        var components = URLComponents()
        components.path = "/modes/code/browse/range"
        components.queryItems = [URLQueryItem(name: "base", value: base), URLQueryItem(name: "head", value: head)]
        showOnCodeTab(components.string ?? Href.review)
    }

    /// The branch you are on, read against what it is aimed at — everything
    /// since the merge base, uncommitted work included. Aiming is remembered
    /// by the server, so the next read of this branch needs no menu.
    func review(_ head: String, against target: String) {
        Task {
            try? await client.setBranchTarget(branch: head, target: target)
            var components = URLComponents()
            components.path = Href.review
            components.queryItems = [URLQueryItem(name: "target", value: target)]
            showOnCodeTab(components.string ?? Href.review)
        }
    }

    private func runGit(_ body: @escaping () async throws -> Void) {
        Task {
            do {
                try await body()
            } catch {
                lastError = error.localizedDescription
            }
            await refresh()
        }
    }
}
