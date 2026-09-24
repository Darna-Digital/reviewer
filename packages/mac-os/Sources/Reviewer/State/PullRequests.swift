// The merge requests: every open pull request on the project's GitHub
// remote, read by the shell itself over the server's API rather than
// reported by an island — the list the sidebar draws on the merge-requests
// surface (see `PullRequestList`), and what the overview beside the diff
// reads the picked one out of (see `PullRequestOverview`) — with the
// sidebar's own search and filters over it, the web list's own three. The
// diff of a pull request is the page island's, at the pull request's
// address; everything else about it is drawn natively from what is held
// here, and what a reviewer does to one — checking it out, merging it,
// closing it unmerged — runs through `AppModel` (see `act(onPull:)`).
//
// Half of what a row carries is about a build running somewhere else, so
// the list is re-read whenever the app comes back to the front, the way
// the web query refetches on focus: a window left beside a CI tab would
// otherwise keep saying a check is still going long after it went red.
import AppKit
import Foundation
import Observation

/// How far back the list reaches — the web filter's own four spans.
enum PullDateFilter: CaseIterable, Identifiable, Sendable {
    case all, today, week, month

    var id: Self { self }

    var label: String {
        switch self {
        case .all: return "Any time"
        case .today: return "Today"
        case .week: return "Past 7 days"
        case .month: return "Past 30 days"
        }
    }

    /// The moment a pull request must have moved since, or nil for any.
    func cutoff(now: Date = Date()) -> Date? {
        switch self {
        case .all: return nil
        case .today: return Calendar.current.startOfDay(for: now)
        case .week: return now.addingTimeInterval(-7 * 86_400)
        case .month: return now.addingTimeInterval(-30 * 86_400)
        }
    }
}

/// The pull requests under the branch they target — the shape of the list,
/// the branches alphabetical, each group keeping GitHub's order.
struct PullRequestGroup: Identifiable {
    let base: String
    let pulls: [PullRequestInfo]

    var id: String { base }

    static func grouped(_ pulls: [PullRequestInfo]) -> [PullRequestGroup] {
        Set(pulls.map(\.baseRef)).sorted().map { base in
            PullRequestGroup(base: base, pulls: pulls.filter { $0.baseRef == base })
        }
    }
}

/// The verdict the checks add up to, and the counts behind it.
struct CheckCounts {
    let passed: Int
    let failed: Int
    let pending: Int
    let neutral: Int
    let total: Int
}

/// What a reviewer is in the middle of doing to a pull request, so the
/// overview's buttons can say so and stand down meanwhile.
enum PullWork: Equatable {
    case checkingOut(Int)
    case merging(Int)
    case closing(Int)

    var number: Int {
        switch self {
        case .checkingOut(let n), .merging(let n), .closing(let n): return n
        }
    }
}

@MainActor
@Observable
final class PullRequests {
    private(set) var pulls: [PullRequestInfo] = []
    /// The first read of a project's list still on its way.
    private(set) var loading = false
    private(set) var error: String?
    /// The GitHub repository the root is on, so there is anywhere for the
    /// list to come from. Nothing is asked for while it is on none.
    private(set) var remote: GitHubRemote?
    /// What is in the middle of being done to one of them, if anything.
    private(set) var work: PullWork?

    var query = ""
    /// The base branch the list is narrowed to, or nil for every branch.
    var baseFilter: String?
    var dateFilter: PullDateFilter = .all

    @ObservationIgnored private let client: ReviewerClient
    @ObservationIgnored private var activation: NSObjectProtocol?
    @ObservationIgnored private var generation = 0

    init(client: ReviewerClient) {
        self.client = client
        activation = NotificationCenter.default.addObserver(
            forName: NSApplication.didBecomeActiveNotification, object: nil, queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in await self?.reload() }
        }
    }

    // MARK: reading

    /// The project re-read — another one opened, or the same one after a
    /// checkout or ⌘R. The same remote as before is read again in place,
    /// its rows staying up; another starts the list over.
    func projectChanged(github: GitHubRemote?) async {
        guard github != remote else {
            await reload()
            return
        }
        generation += 1
        remote = github
        pulls = []
        error = nil
        guard hasGitHub else {
            loading = false
            return
        }
        loading = true
        await fetch(generation: generation)
    }

    var hasGitHub: Bool { remote != nil }

    /// The list read again in place — the app coming to the front, an
    /// action done to one of them. The rows stay up while it is on its way.
    func reload() async {
        guard hasGitHub else { return }
        await fetch(generation: generation)
    }

    private func fetch(generation: Int) async {
        do {
            let fetched = try await client.pulls()
            guard generation == self.generation else { return }
            pulls = fetched
            error = nil
        } catch {
            guard generation == self.generation else { return }
            self.error = error.localizedDescription
        }
        loading = false
    }

    // MARK: the list

    /// Every base branch the open pull requests target, for the filter.
    var baseBranches: [String] {
        Set(pulls.map(\.baseRef)).sorted()
    }

    /// The rows the list shows: what the search and the filters keep, under
    /// the branch each targets.
    var groups: [PullRequestGroup] {
        let cutoff = dateFilter.cutoff()
        let needle = query.trimmingCharacters(in: .whitespaces).drop { $0 == "#" }.lowercased()
        let kept = pulls.filter { pull in
            if let cutoff, let updated = Wire.date(pull.updatedAt), updated < cutoff { return false }
            if let baseFilter, pull.baseRef != baseFilter { return false }
            guard !needle.isEmpty else { return true }
            let haystack = "\(pull.number)\n\(pull.title)\n\(pull.author)\n\(pull.headRef)".lowercased()
            return haystack.contains(needle)
        }
        return PullRequestGroup.grouped(kept)
    }

    /// Whether anything narrows the list beyond the search, for the filter
    /// button's dot.
    var isNarrowed: Bool {
        baseFilter != nil || dateFilter != .all
    }

    var isFiltered: Bool {
        isNarrowed || !query.trimmingCharacters(in: .whitespaces).isEmpty
    }

    func clearFilters() {
        query = ""
        baseFilter = nil
        dateFilter = .all
    }

    /// The pull request numbered `number` as the list has it — or, while the
    /// list has not caught up with an address, the number alone, so the
    /// overview has something to stand on until the row arrives.
    func pull(numbered number: Int) -> PullRequestInfo {
        pulls.first { $0.number == number } ?? PullRequestInfo.unenriched(number: number)
    }

    /// Whether the list has been read and holds no such pull request: it
    /// was merged, closed, or never this project's.
    func isGone(_ number: Int) -> Bool {
        hasGitHub && !loading && error == nil && !pulls.contains { $0.number == number }
    }

    // MARK: actions

    /// Fetch the pull request's head and check it out as `branch`. Answers
    /// the branch checked out, or nil when the server refused.
    func checkout(_ pull: PullRequestInfo, as branch: String) async throws -> String {
        try await working(.checkingOut(pull.number)) {
            try await client.checkoutPull(number: pull.number, branch: branch)
        }
    }

    /// Land the pull request on its base, on GitHub. Answers GitHub's own
    /// sentence about what happened.
    func merge(_ pull: PullRequestInfo, method: MergeMethod) async throws -> String {
        try await working(.merging(pull.number)) {
            try await client.mergePull(number: pull.number, method: method).message
        }
    }

    /// Close the pull request without merging it.
    func close(_ pull: PullRequestInfo) async throws -> String {
        try await working(.closing(pull.number)) {
            try await client.closePull(number: pull.number).message
        }
    }

    private func working<T>(_ work: PullWork, _ body: () async throws -> T) async throws -> T {
        self.work = work
        defer { self.work = nil }
        return try await body()
    }
}

extension PullRequestInfo {
    /// A pull request known by its number alone — what an address names
    /// before the list has answered, with the enriched half empty.
    static func unenriched(number: Int) -> PullRequestInfo {
        PullRequestInfo(
            number: number, title: "#\(number)", author: "", baseRef: "", headRef: "", headSha: "", url: "",
            updatedAt: "", createdAt: "", body: "", draft: false, fromFork: false, mergeable: .unknown,
            checks: [], assignees: [], reviewers: [], labels: [], additions: 0, deletions: 0, changedFiles: 0)
    }

    /// What CI says, as one word — or nil where the repository runs no
    /// checks on this commit, which is not the same as passing and is not
    /// drawn as it.
    var checksState: CheckState? {
        guard !checks.isEmpty else { return nil }
        if checks.contains(where: { $0.state == .failure }) { return .failure }
        if checks.contains(where: { $0.state == .pending }) { return .pending }
        if checks.contains(where: { $0.state == .success }) { return .success }
        return .neutral
    }

    var checkCounts: CheckCounts {
        func count(_ state: CheckState) -> Int { checks.filter { $0.state == state }.count }
        return CheckCounts(
            passed: count(.success), failed: count(.failure), pending: count(.pending), neutral: count(.neutral),
            total: checks.count)
    }

    /// The verdict, in as few words as a row can hold.
    var checksHeadline: String? {
        switch checksState {
        case .failure: return "Checks failing"
        case .pending: return "Checks running"
        case .success: return "All checks passing"
        case .neutral: return "No check reached a verdict"
        case nil: return nil
        }
    }

    /// How many of them are through and passing, as a row's right-hand figure.
    var checksTally: String? {
        let counts = checkCounts
        guard counts.total > 0 else { return nil }
        return counts.failed > 0 ? "\(counts.failed)/\(counts.total) failing" : "\(counts.passed)/\(counts.total)"
    }

    /// The sentence a CI badge says on hover — the counts, not just the verdict.
    var checksSummary: String? {
        guard let headline = checksHeadline else { return nil }
        let counts = checkCounts
        let parts = [
            counts.failed > 0 ? "\(counts.failed) failing" : nil,
            counts.pending > 0 ? "\(counts.pending) running" : nil,
            counts.passed > 0 ? "\(counts.passed) passing" : nil,
            counts.neutral > 0 ? "\(counts.neutral) skipped" : nil,
        ].compactMap { $0 }
        return "\(headline) — \(parts.joined(separator: ", ")) of \(counts.total)"
    }

    /// Why this cannot be merged as it stands, or nil when nothing is in
    /// the way that we know of. "Unknown" says nothing: GitHub works
    /// mergeability out lazily, and a blocker drawn for that would cry
    /// wolf on every cold list.
    var blockedReason: String? {
        guard mergeable == .conflicting else { return nil }
        return "#\(number) conflicts with \(baseRef). Merge \(baseRef) into \(headRef) and resolve the conflicts before this can be merged."
    }

    /// Why the merge button cannot be pressed, or nil when it can: only the
    /// two things GitHub itself would refuse. Failing checks are not among
    /// them — whether a red check stops a merge is the repository's rule.
    var mergeBlockedReason: String? {
        if draft { return "#\(number) is a draft. Mark it ready for review on GitHub before merging." }
        return blockedReason
    }

    /// What the confirmation says beyond the branch names — the reasons to
    /// think twice that are not reasons to refuse.
    var mergeCaution: String? {
        let counts = checkCounts
        let parts = [
            counts.failed > 0 ? "\(counts.failed) check\(counts.failed == 1 ? " is" : "s are") failing" : nil,
            counts.pending > 0 ? "\(counts.pending) check\(counts.pending == 1 ? " is" : "s are") still running" : nil,
            mergeable == .unknown ? "GitHub has not worked out whether this merges cleanly" : nil,
        ].compactMap { $0 }
        return parts.isEmpty ? nil : "\(parts.joined(separator: ", "))."
    }

    /// The local branch to check the pull request out onto: its own name,
    /// unless it came from a fork — in which case the name is someone
    /// else's and may well be one of ours too, so a fork lands on a branch
    /// named after the pull request instead.
    var localBranch: String {
        guard fromFork else { return headRef }
        // Ref names may not hold a space, `~^:?*[`, a backslash, or two
        // dots in a row; a fork's branch name has been through none of
        // our validation.
        let safe = headRef
            .replacing(/[\s~^:?*\[\\]+/, with: "-")
            .replacing(/\.\.+/, with: ".")
            .trimmingCharacters(in: CharacterSet(charactersIn: "./"))
        return safe.isEmpty ? "pr-\(number)" : "pr-\(number)-\(safe)"
    }

    var updated: Date? { Wire.date(updatedAt) }
    var created: Date? { Wire.date(createdAt) }
}
