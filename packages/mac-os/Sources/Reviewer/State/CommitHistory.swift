// The bottom pane's History: the commit log as the web app's history dock
// reads it — one ref's ancestry, or every ref's, narrowed by the same
// filters — a page at a time, each fetched past the ones already held and
// appended, so walking back through a long history neither refetches what
// is on screen nor rebuilds those rows. A project of several roots reads
// one merged history covering all of them, each commit saying where it came
// from, narrowed to one root when asked; a single-root project keeps the
// per-branch log. The selected commit's detail — its message, its files —
// is read on selection and kept by sha, so stepping back to a commit is
// free.
import Foundation
import Observation

@MainActor
@Observable
final class CommitHistory {
    static let pageSize = 150

    /// The ref whose history is listed, or nil to follow HEAD.
    var ref: String? { didSet { if ref != oldValue { reload() } } }
    var query = LogQuery.empty { didSet { if query != oldValue { reload() } } }
    /// The root the merged history is narrowed to, for a multi-root project.
    var repoFilter: String? { didSet { if repoFilter != oldValue { reload() } } }

    private(set) var commits: [CommitInfo] = []
    /// The commits laid into the graph's lanes, kept with them so the rows
    /// draw from it rather than laying the whole list out again.
    private(set) var graph = CommitGraphLayout.empty
    /// Which root each commit came from, when the history covers several.
    private(set) var owners: [String: RepoEntry] = [:]
    private(set) var isLoading = false
    private(set) var hasMore = false
    private(set) var loadError: String?

    var selectedSha: String? { didSet { if selectedSha != oldValue { selectedFile = nil; loadDetail() } } }
    /// The file opened from the selected commit, lit in its file list.
    var selectedFile: String?
    private(set) var details: [String: CommitDetail] = [:]
    private(set) var detailError: String?
    private(set) var isLoadingDetail = false

    /// The project's roots, when it holds several — the merged history's
    /// shape and its repository filter both follow from them.
    private(set) var repos: [RepoEntry] = []
    /// The branch the repository is on, which is what a nil `ref` names.
    var head: String?

    @ObservationIgnored private let client: ReviewerClient
    @ObservationIgnored private var pageTask: Task<Void, Never>?
    /// Bumped by every reload so a page that lands late is dropped rather
    /// than appended to a different history.
    @ObservationIgnored private var generation = 0
    /// How many commits the merged log has been read past — more than are
    /// held once a root filter drops some, so the next page must skip by it.
    @ObservationIgnored private var mergedRead = 0

    init(client: ReviewerClient) {
        self.client = client
    }

    var isMultiRoot: Bool { repos.count > 1 }

    /// The ref the log is read for: the one chosen, else the branch you are on.
    var effectiveRef: String { ref ?? head ?? "HEAD" }

    var selected: CommitInfo? {
        commits.first { $0.sha == selectedSha }
    }

    var selectedDetail: CommitDetail? {
        selectedSha.flatMap { details[$0] }
    }

    /// The project as it stands — its roots, the branch it is on. A change
    /// of either starts the history over, since a ref belongs to the root it
    /// was read from and the filters with it.
    func projectChanged(repos: [RepoEntry], head: String?) {
        let rootsChanged = repos.map(\.path) != self.repos.map(\.path)
        self.repos = repos
        self.head = head
        if rootsChanged {
            ref = nil
            query = .empty
            repoFilter = nil
            selectedSha = nil
            details = [:]
        }
        reload()
    }

    /// Follow one file's past — the "Show history" action, from wherever it
    /// is asked: the log narrows to that file, following it through renames.
    func show(historyOf path: String) {
        query = .history(of: path)
    }

    func reload() {
        generation += 1
        pageTask?.cancel()
        commits = []
        graph = .empty
        owners = [:]
        mergedRead = 0
        hasMore = false
        loadError = nil
        guard !repos.isEmpty else {
            isLoading = false
            return
        }
        fetchPage()
    }

    /// The next page, once the list nears its end. A page already on its way
    /// is left to land: a single flick of the wheel is not several requests.
    func loadMore() {
        guard hasMore, !isLoading else { return }
        fetchPage()
    }

    private func fetchPage() {
        let generation = generation
        isLoading = true
        pageTask = Task {
            do {
                let page = try await readPage()
                guard generation == self.generation, !Task.isCancelled else { return }
                commits.append(contentsOf: page.commits)
                graph = CommitGraphLayout.layout(commits)
                owners.merge(page.owners) { _, latest in latest }
                hasMore = page.full
                loadError = nil
                // A root filter can drop a whole page of the merged log,
                // leaving the list as it was; the next page is asked for
                // outright, since no row of it will come into view to ask.
                if page.full && page.commits.isEmpty {
                    isLoading = false
                    fetchPage()
                    return
                }
            } catch {
                guard generation == self.generation, !Task.isCancelled else { return }
                loadError = error.localizedDescription
                hasMore = false
            }
            isLoading = false
        }
    }

    private struct Page {
        let commits: [CommitInfo]
        let owners: [String: RepoEntry]
        /// A short page is the end of the history; a full one may have more.
        let full: Bool
    }

    private func readPage() async throws -> Page {
        if isMultiRoot {
            let log = try await client.projectLog(query: query, skip: mergedRead, limit: Self.pageSize)
            mergedRead += log.commits.count
            let kept = log.commits.filter { repoFilter == nil || $0.repo.path == repoFilter }
            return Page(
                commits: kept.map(\.commit),
                owners: Dictionary(kept.map { ($0.commit.sha, $0.repo) }) { _, latest in latest },
                full: log.commits.count >= Self.pageSize)
        }
        let page = try await client.log(ref: effectiveRef, query: query, skip: commits.count, limit: Self.pageSize)
        return Page(commits: page, owners: [:], full: page.count >= Self.pageSize)
    }

    private func loadDetail() {
        detailError = nil
        guard let sha = selectedSha, details[sha] == nil else { return }
        isLoadingDetail = true
        Task {
            do {
                let detail = try await client.commitDetail(sha: sha)
                details[sha] = detail
            } catch {
                if selectedSha == sha { detailError = error.localizedDescription }
            }
            if selectedSha == sha { isLoadingDetail = false }
        }
    }
}
