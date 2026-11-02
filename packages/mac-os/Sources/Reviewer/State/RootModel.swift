// One repository of the open workspace — a root, as JetBrains calls each
// version-controlled folder a project holds side by side — and everything
// the window keeps about it: its git status and branches, its files for the
// sidebar's tree, its dev commands, its terminals and its pull requests,
// each read through a client scoped to it, so the server answers for this
// repository whichever one the page is on.
//
// Every root is live at once: its dev commands keep running, its terminals
// stay attached and its watchers keep listening while the page is on
// another, and the panes that span the workspace — Run, Branches,
// Terminal, the merge requests, the tree — list every root's. The window's
// own single-repository surfaces (the branch chip, the commit chords, the
// history) follow the focused root, the one the page is on (see
// `AppModel.focusedRoot`).
import Foundation
import Observation

@MainActor
@Observable
final class RootModel: @MainActor Identifiable {
    let path: String
    /// The folder's own name, what the root reads as in the tree's header
    /// and the panes' sections.
    let name: String
    let client: ReviewerClient

    var status: RepoStatus?
    var branches: [BranchInfo] = []
    var remoteBranches: [RemoteBranchInfo] = []
    /// Every file the repository holds and what git says of the changed
    /// ones — what the sidebar draws under this root while the page is on
    /// another (the page reports its own root's tree).
    private(set) var files: FilesPayload?
    /// The branch read when the workspace was, until the status answers.
    @ObservationIgnored private var openedOnBranch: String?

    let services: DevServices
    let threads: Threads
    let pullRequests: PullRequests

    @ObservationIgnored private var headWatcher: HeadWatcher?
    @ObservationIgnored private var worktreeWatcher: WorktreeWatcher?
    /// HEAD moved under this repository outside the app — a checkout in a
    /// terminal.
    @ObservationIgnored var onHeadMoved: ((RootModel) -> Void)?
    /// A file in this repository's working tree changed on disk.
    @ObservationIgnored var onWorktreeChanged: ((RootModel) -> Void)?
    /// Its files, their status or its branch read afresh — what the
    /// sidebar's tree stands on (see `treeRoot`).
    @ObservationIgnored var onListingChanged: ((RootModel) -> Void)?

    /// The repository as the sidebar's tree stands it under its header.
    var treeRoot: TreeRoot {
        TreeRoot(path: path, name: name, branch: branch, paths: files?.paths ?? [], gitStatus: files?.gitStatus ?? [])
    }

    var id: String { path }

    /// The branch it is on, or nil while HEAD is detached.
    var branch: String? { status?.branch ?? openedOnBranch }

    init(root: WorkspaceRoot, client: ReviewerClient) {
        path = root.path
        name = root.name
        openedOnBranch = root.branch
        self.client = client.scoped(to: root.path)
        services = DevServices(client: self.client)
        threads = Threads(client: self.client)
        pullRequests = PullRequests(client: self.client)
    }

    /// The watchers on, once the root is one the window keeps.
    func startWatching() {
        headWatcher = HeadWatcher { [weak self] in
            guard let self else { return }
            onHeadMoved?(self)
        }
        worktreeWatcher = WorktreeWatcher { [weak self] in
            guard let self else { return }
            onWorktreeChanged?(self)
        }
        headWatcher?.watch(project: path)
        worktreeWatcher?.watch(project: path)
    }

    /// The root closed: its watchers off and its sockets let go. Its dev
    /// commands are the server's to stop, as the root leaves the workspace.
    func close() {
        headWatcher?.stop()
        worktreeWatcher?.stop()
        headWatcher = nil
        worktreeWatcher = nil
        services.reset()
        threads.reset()
    }

    func remember(branch: String?) {
        openedOnBranch = branch
    }

    /// Everything about the repository read afresh — its status, branches,
    /// files, dev commands, terminals and pull requests — side by side,
    /// since no read waits on another.
    func refresh() async {
        async let status = try? client.repoStatus()
        async let branches: Void = loadBranches()
        async let files: Void = loadFiles()
        async let services: Void = self.services.load()
        async let threads: Void = self.threads.load()
        async let repo = try? client.repoInfo()
        self.status = await status
        _ = await (branches, files, services, threads)
        onListingChanged?(self)
        await pullRequests.projectChanged(github: (await repo)?.github)
    }

    func loadBranches() async {
        async let local = client.branches()
        async let remote = client.remoteBranches()
        branches = (try? await local) ?? []
        remoteBranches = (try? await remote) ?? []
    }

    func loadFiles() async {
        if let files = try? await client.files() { self.files = files }
    }

    /// Only what git says moved: the status and the changed files, on a
    /// change on disk.
    func refreshWorktree() async {
        async let status = try? client.repoStatus()
        async let files: Void = loadFiles()
        self.status = await status
        await files
        onListingChanged?(self)
    }

    /// A read of HEAD that says whether it moved since the last one.
    func headMoved() async -> Bool {
        let fresh = try? await client.repoStatus()
        return fresh?.branch != status?.branch || fresh?.headSha != status?.headSha
    }
}
