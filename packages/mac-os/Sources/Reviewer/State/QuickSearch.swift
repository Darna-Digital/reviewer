// The search dialog's model: the web app's search palette — a double tap
// of Shift to find a file by name, ⌘⇧F to grep the working tree — done
// natively, since inside the shell the palette itself is not mounted (it
// belongs to the web app's window frame, which an island has none of) and
// a native window wants a native dialog anyway.
//
// The two searches keep the rules the web app's have: a file query is a
// fuzzy subsequence match over every path, scored so tighter and earlier
// matches win and capped so the whole repository never becomes a result
// list; a text query is one request to the server, debounced so a typed
// word is one search, held back under two characters, and answered with
// its hits grouped under their files in the order git found them. Each
// mode keeps its query between openings — reopening a search you ran a
// minute ago should show it, not an empty box.
import Foundation
import Observation

enum QuickSearchMode: String, CaseIterable, Identifiable, Sendable {
    case files
    case text

    var id: String { rawValue }

    var title: String {
        switch self {
        case .files: return "Files"
        case .text: return "Text"
        }
    }

    var placeholder: String {
        switch self {
        case .files: return "Search files by name…"
        case .text: return "Search in files…"
        }
    }
}

/// How wide a search runs: the root being followed, or every root the open
/// project holds. A multi-root project searches the project, so a hit in
/// `backend` is as findable as one in `frontend` — and comes back named from
/// the project folder, which is the name the page opens it by.
enum SearchScope: Sendable {
    case repo
    case project
}

/// One row of the dialog's list, whichever mode built it. Rows carry their
/// file so the list can put a heading over each run of the same one.
struct QuickSearchRow: Identifiable, Hashable, Sendable {
    let path: String
    /// The line a text hit is on; nil for a file row.
    let line: Int?
    /// The text hit's line, or nothing — a file row shows its path.
    let text: String

    var id: String {
        line.map { "\(path):\($0)" } ?? path
    }
}

@MainActor
@Observable
final class QuickSearch {
    /// Below this, a text query matches so much that searching is only noise.
    static let minimumQueryLength = 2
    /// Typing the whole repository into the list helps nobody.
    static let maximumFileResults = 40
    static let maximumMatches = 500
    /// Long enough that a typed word is one request, short enough to feel live.
    private static let debounce: Duration = .milliseconds(180)

    var isShown = false
    var mode: QuickSearchMode = .files
    var fileQuery = "" {
        didSet { fileResults = Self.fuzzyFilter(paths, by: fileQuery) }
    }
    var textQuery = "" {
        didSet { scheduleGrep() }
    }
    var options = GrepOptions() {
        didSet { scheduleGrep() }
    }

    private(set) var fileResults: [String] = []
    private(set) var matches: ContentMatches = .empty
    private(set) var isSearching = false
    private(set) var searchError: String?

    /// What the dialog opens: a file, at a line when a text hit named one.
    @ObservationIgnored var onOpen: ((String, Int?) -> Void)?

    @ObservationIgnored private let client: ReviewerClient
    @ObservationIgnored private var scope: SearchScope = .repo
    @ObservationIgnored private var paths: [String] = []
    @ObservationIgnored private var pathsLoaded = false
    @ObservationIgnored private var grepTask: Task<Void, Never>?

    init(client: ReviewerClient) {
        self.client = client
    }

    var query: String {
        get { mode == .files ? fileQuery : textQuery }
        set {
            if mode == .files { fileQuery = newValue } else { textQuery = newValue }
        }
    }

    /// The list on screen, whatever mode built it.
    var rows: [QuickSearchRow] {
        switch mode {
        case .files:
            return fileResults.map { QuickSearchRow(path: $0, line: nil, text: $0) }
        case .text:
            return matches.matches.map { QuickSearchRow(path: $0.path, line: $0.line, text: $0.text) }
        }
    }

    var scopeName: String {
        scope == .project ? "project" : "repository"
    }

    // MARK: opening

    /// Open on `mode`, holding `seed` when the gesture brought a phrase —
    /// ⌘⇧F over a highlighted word searches for it. An empty seed leaves
    /// the box as the last search left it.
    func open(_ mode: QuickSearchMode, seed: String = "") {
        self.mode = mode
        if !seed.isEmpty { query = seed }
        isShown = true
        if mode == .files { Task { await loadPathsIfNeeded() } }
    }

    func close() {
        isShown = false
    }

    func open(_ row: QuickSearchRow) {
        close()
        onOpen?(row.path, row.line)
    }

    // MARK: project

    /// A project came in or went stale — ⌘R, a switch — so the file list is
    /// read again on the next opening, and the width of the search follows
    /// how many roots the project holds.
    func projectChanged(scope: SearchScope) {
        self.scope = scope
        pathsLoaded = false
        paths = []
        fileResults = []
        matches = .empty
        searchError = nil
    }

    private func loadPathsIfNeeded() async {
        guard !pathsLoaded else { return }
        pathsLoaded = true
        do {
            let payload = try await (scope == .project ? client.projectFiles() : client.files())
            paths = payload.paths
            fileResults = Self.fuzzyFilter(paths, by: fileQuery)
        } catch {
            pathsLoaded = false
            searchError = error.localizedDescription
        }
    }

    // MARK: grep

    /// Every keystroke restarts the wait, so the request goes out once the
    /// typing pauses; the results already on screen stay put meanwhile
    /// rather than blinking empty on every letter.
    private func scheduleGrep() {
        grepTask?.cancel()
        let query = textQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard query.count >= Self.minimumQueryLength else {
            matches = .empty
            isSearching = false
            searchError = nil
            return
        }
        let options = options
        let scope = scope
        isSearching = true
        grepTask = Task {
            try? await Task.sleep(for: Self.debounce)
            guard !Task.isCancelled else { return }
            do {
                let found = try await client.search(query, options: options, scope: scope, limit: Self.maximumMatches)
                guard !Task.isCancelled else { return }
                matches = found
                searchError = nil
            } catch {
                guard !Task.isCancelled else { return }
                matches = .empty
                searchError = error.localizedDescription
            }
            isSearching = false
        }
    }

    /// Where the pattern hit `text`, for highlighting — the same rules the
    /// request ran under, over the one line being drawn. A regex that does
    /// not parse yet (the user is still typing it) highlights nothing.
    static func matchRange(in text: String, query: String, options: GrepOptions) -> Range<String.Index>? {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        let source = options.regex ? trimmed : NSRegularExpression.escapedPattern(for: trimmed)
        let pattern = options.wholeWord ? "\\b(?:\(source))\\b" : source
        guard let expression = try? NSRegularExpression(
            pattern: pattern, options: options.caseSensitive ? [] : [.caseInsensitive])
        else { return nil }
        let whole = NSRange(text.startIndex..., in: text)
        guard let found = expression.firstMatch(in: text, range: whole), found.range.length > 0 else { return nil }
        return Range(found.range, in: text)
    }

    // MARK: files

    /// Paths matching `query`, best first and capped. A blank query matches
    /// nothing: the whole file list is not a search result.
    static func fuzzyFilter(_ paths: [String], by query: String) -> [String] {
        let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !needle.isEmpty else { return [] }
        return paths.lazy
            .compactMap { path in fuzzyScore(path, needle).map { (path, $0) } }
            .sorted { $0.1 < $1.1 }
            .prefix(maximumFileResults)
            .map(\.0)
    }

    /// Subsequence match: every character of `needle` in order somewhere in
    /// `text`. Lower is better — an early start and a compact span win — and
    /// nil is no match. `needle` is already lowercased.
    static func fuzzyScore(_ text: String, _ needle: String) -> Double? {
        let haystack = Array(text.lowercased().utf8)
        var from = 0
        var firstHit = -1
        var lastHit = -1
        for character in needle.utf8 {
            guard let found = haystack[from...].firstIndex(of: character) else { return nil }
            if firstHit == -1 { firstHit = found }
            lastHit = found
            from = found + 1
        }
        return Double(firstHit) + Double(lastHit - firstHit) * 0.5
    }
}
