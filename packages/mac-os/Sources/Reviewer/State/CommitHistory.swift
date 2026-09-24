// The bottom pane's History: the commit log as the web app's history dock
// reads it — one ref's ancestry, or every ref's, narrowed by the same
// filters — a page at a time, each fetched past the ones already held and
// appended, so walking back through a long history neither refetches what
// is on screen nor rebuilds those rows. The selected commit's detail — its
// message, its files — is read on selection and kept by sha, so stepping
// back to a commit is free.
import Foundation
import Observation

@MainActor
@Observable
final class CommitHistory {
    static let pageSize = 150

    /// The ref whose history is listed, or nil to follow HEAD.
    var ref: String? { didSet { if ref != oldValue { reload() } } }
    var query = LogQuery.empty { didSet { if query != oldValue { reload() } } }

    private(set) var commits: [CommitInfo] = []
    /// The commits laid into the graph's lanes, kept with them so the rows
    /// draw from it rather than laying the whole list out again.
    private(set) var graph = CommitGraphLayout.empty
    private(set) var isLoading = false
    private(set) var hasMore = false
    private(set) var loadError: String?

    var selectedSha: String? { didSet { if selectedSha != oldValue { selectedFile = nil; loadDetail() } } }
    /// The file opened from the selected commit, lit in its file list.
    var selectedFile: String?
    private(set) var details: [String: CommitDetail] = [:]
    private(set) var detailError: String?
    private(set) var isLoadingDetail = false

    /// The open repository, or nil while nothing is; a change of it starts
    /// the history over, since a ref belongs to the repository it was read
    /// from and the filters with it.
    private(set) var project: String?
    /// The branch the repository is on, which is what a nil `ref` names.
    var head: String?

    @ObservationIgnored private let client: ReviewerClient
    @ObservationIgnored private var pageTask: Task<Void, Never>?
    /// Bumped by every reload so a page that lands late is dropped rather
    /// than appended to a different history.
    @ObservationIgnored private var generation = 0

    init(client: ReviewerClient) {
        self.client = client
    }

    /// The ref the log is read for: the one chosen, else the branch you are on.
    var effectiveRef: String { ref ?? head ?? "HEAD" }

    var selected: CommitInfo? {
        commits.first { $0.sha == selectedSha }
    }

    var selectedDetail: CommitDetail? {
        selectedSha.flatMap { details[$0] }
    }

    /// The project as it stands — the repository, the branch it is on.
    func projectChanged(project: String?, head: String?) {
        let repositoryChanged = project != self.project
        self.project = project
        self.head = head
        if repositoryChanged {
            ref = nil
            query = .empty
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
        hasMore = false
        loadError = nil
        guard project != nil else {
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
                commits.append(contentsOf: page)
                graph = CommitGraphLayout.layout(commits)
                hasMore = page.count >= Self.pageSize
                loadError = nil
            } catch {
                guard generation == self.generation, !Task.isCancelled else { return }
                loadError = error.localizedDescription
                hasMore = false
            }
            isLoading = false
        }
    }

    /// A short page is the end of the history; a full one may have more.
    private func readPage() async throws -> [CommitInfo] {
        try await client.log(ref: effectiveRef, query: query, skip: commits.count, limit: Self.pageSize)
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
