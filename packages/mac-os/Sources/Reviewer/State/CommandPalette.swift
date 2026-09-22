// The palette's model: the web app's search dialog — ⌘K for the commands
// it opens on, a double tap of Shift to find a file by name, ⌘⇧F to grep
// the working tree — done natively, since inside the shell the dialog
// itself is not mounted (it belongs to the web app's window frame, which
// an island has none of) and a native window wants a native dialog anyway.
//
// The shape is the web dialog's: one box over a stack of lists. Commands
// is the root; some of its rows lead deeper rather than acting — Files
// and Text are the two searches, Git holds the git actions and leads on to
// Branches, which checks one out — and a breadcrumb over the box says
// which list is up and walks back. The two searches keep the rules the web
// app's have: a file query is a fuzzy subsequence match over every path,
// scored so tighter and earlier matches win and capped so the whole
// repository never becomes a result list; a text query is one request to
// the server, debounced so a typed word is one search, held back under
// two characters, and answered with its hits grouped under their files in
// the order git found them. The searches keep their query between openings
// — reopening a search you ran a minute ago should show it, not an empty
// box — while the menus start fresh every time. The commands and the
// branches are the shell's own (see `AppModel.paletteCommands`), read
// afresh each time a list is shown.
import Foundation
import Observation

/// Which of the palette's lists is on screen.
enum PaletteMode: String, CaseIterable, Identifiable, Sendable {
    case commands
    case files
    case text
    case git
    case branches

    var id: String { rawValue }

    var title: String {
        switch self {
        case .commands: return "Commands"
        case .files: return "Files"
        case .text: return "Text"
        case .git: return "Git"
        case .branches: return "Branches"
        }
    }

    var placeholder: String {
        switch self {
        case .commands: return "Type a command…"
        case .files: return "Search files by name…"
        case .text: return "Search in files…"
        case .git: return "Type a git action…"
        case .branches: return "Search branches…"
        }
    }

    /// The list this one hangs off, or nil for the command list at the
    /// root. Declared once, so a mode's breadcrumb trail, the row that
    /// opens it and where Backspace on an empty box returns to never drift.
    var parent: PaletteMode? {
        switch self {
        case .commands: return nil
        case .files, .text, .git: return .commands
        case .branches: return .git
        }
    }

    /// Where you are in the palette, root first. The command list heads
    /// every trail, so the header keeps its shape between lists.
    var crumbs: [PaletteMode] {
        var trail = [self]
        while let up = trail[0].parent { trail.insert(up, at: 0) }
        return trail
    }

    /// The menus, which are not searches: they start on an empty box.
    var isMenu: Bool {
        switch self {
        case .commands, .git, .branches: return true
        case .files, .text: return false
        }
    }
}

/// A list the palette walks into, as the row that opens it reads.
struct PaletteSubmenu {
    let mode: PaletteMode
    let label: String
    let group: String
    let symbol: String
    let keywords: String
    /// The chord that opens it directly, on the row's trailing edge.
    let hint: String?

    static let all: [PaletteSubmenu] = [
        PaletteSubmenu(
            mode: .files, label: "Go to file…", group: "Search", symbol: "doc",
            keywords: "open path jump navigate", hint: "⇧⇧"),
        PaletteSubmenu(
            mode: .text, label: "Search in files…", group: "Search", symbol: "magnifyingglass",
            keywords: "grep content text find occurrences", hint: "⇧⌘F"),
        PaletteSubmenu(
            mode: .git, label: "Git actions…", group: "Git", symbol: "arrow.triangle.branch",
            keywords: "fetch pull push branch merge rebase", hint: nil),
        PaletteSubmenu(
            mode: .branches, label: "Switch branch…", group: "Git", symbol: "arrow.left.arrow.right",
            keywords: "checkout switch change branch", hint: nil),
    ]
}

/// An action the command list offers, built by the shell, which has the
/// window, the page and git in scope, so the palette stays presentational.
struct PaletteCommand: Identifiable {
    let id: String
    let label: String
    /// The heading the command is grouped under — Navigation, Git, View.
    let group: String
    let symbol: String
    /// Extra search terms not shown in the label.
    var keywords = ""
    /// A current value or a chord, on the row's trailing edge.
    var hint: String? = nil
    /// The list the command lives in; the command list when nil.
    var submenu: PaletteMode? = nil
    let run: @MainActor () -> Void
}

/// A branch the checkout list offers, local and remote flattened into one
/// row: the ref to check out, and the name it is shown under.
struct PaletteBranch: Identifiable, Hashable, Sendable {
    let name: String
    let ref: String
    let group: String
    let isCurrent: Bool
    /// Ahead and behind counts, or which remote it came from.
    let hint: String?

    var id: String { "\(group):\(name)" }
}

/// One row of the list, whichever list built it. Rows carry their heading
/// so the list can put one over each run of the same.
struct PaletteRow: Identifiable {
    enum Content {
        case command(label: String, symbol: String)
        case file(path: String)
        case match(path: String, line: Int, text: String)
        case branch(name: String)
    }

    let id: String
    let group: String
    let content: Content
    var hint: String? = nil
    /// Rows that lead deeper into the palette keep it open.
    var closesOnRun = true
    let run: @MainActor () -> Void

    /// The file running the row opens, where it opens one.
    var path: String? {
        switch content {
        case .file(let path), .match(let path, _, _): return path
        case .command, .branch: return nil
        }
    }
}

@MainActor
@Observable
final class CommandPalette {
    /// Below this, a text query matches so much that searching is only noise.
    static let minimumQueryLength = 2
    /// Typing the whole repository into the list helps nobody.
    static let maximumFileResults = 40
    /// Same for a repository whose remote has a branch per open ticket.
    static let maximumBranchResults = 40
    static let maximumMatches = 500
    /// Long enough that a typed word is one request, short enough to feel live.
    private static let debounce: Duration = .milliseconds(180)

    var isShown = false
    private(set) var mode: PaletteMode = .commands
    var options = GrepOptions() {
        didSet { scheduleGrep() }
    }

    private(set) var fileResults: [String] = []
    private(set) var matches: ContentMatches = .empty
    private(set) var isSearching = false
    private(set) var searchError: String?
    private(set) var commands: [PaletteCommand] = []
    private(set) var branches: [PaletteBranch] = []

    /// What a search row opens: a file, at a line when a text hit named one.
    @ObservationIgnored var onOpen: ((String, Int?) -> Void)?
    /// The file the highlighted row would open. Return is a keystroke away
    /// from it, so this is the moment to have the page read and highlight it.
    @ObservationIgnored var onIntent: ((String) -> Void)?
    /// What a branch row does: the checkout.
    @ObservationIgnored var onCheckout: ((String) -> Void)?
    /// The shell's commands and branches, read whenever a list is shown so
    /// a toggle's label says what it would do next.
    @ObservationIgnored var commandSource: (() -> [PaletteCommand])?
    @ObservationIgnored var branchSource: (() -> [PaletteBranch])?

    @ObservationIgnored private let client: ReviewerClient
    @ObservationIgnored private var paths: [String] = []
    @ObservationIgnored private var pathsLoaded = false
    @ObservationIgnored private var grepTask: Task<Void, Never>?

    private var fileQuery = "" {
        didSet { fileResults = Self.fuzzyFilter(paths, by: fileQuery) }
    }
    private var textQuery = "" {
        didSet { scheduleGrep() }
    }
    private var menuQuery = ""

    init(client: ReviewerClient) {
        self.client = client
    }

    /// The box: one query per search, kept while the palette is closed, and
    /// one shared by the menus, cleared every time one is shown.
    var query: String {
        get {
            switch mode {
            case .files: return fileQuery
            case .text: return textQuery
            case .commands, .git, .branches: return menuQuery
            }
        }
        set {
            switch mode {
            case .files: fileQuery = newValue
            case .text: textQuery = newValue
            case .commands, .git, .branches: menuQuery = newValue
            }
        }
    }

    // MARK: opening

    /// Open on `mode`, holding `seed` when the gesture brought a phrase —
    /// ⌘⇧F over a highlighted word searches for it. An empty seed leaves
    /// the box as the last search left it.
    func open(_ mode: PaletteMode, seed: String = "") {
        show(mode)
        if !seed.isEmpty { query = seed }
        isShown = true
    }

    /// ⌘K: a second press closes the command list, but from another list it
    /// brings the commands back first rather than closing what you were
    /// doing.
    func toggleCommands() {
        if isShown && mode == .commands {
            close()
        } else {
            open(.commands)
        }
    }

    /// Another list up in the same palette — a crumb, a row that leads
    /// deeper, Backspace on an empty box.
    func show(_ mode: PaletteMode) {
        self.mode = mode
        if mode.isMenu { menuQuery = "" }
        commands = commandSource?() ?? []
        branches = branchSource?() ?? []
        if mode == .files { Task { await loadPathsIfNeeded() } }
    }

    /// Back up the trail. False at the root, where Backspace is the box's.
    func back() -> Bool {
        guard let parent = mode.parent else { return false }
        show(parent)
        return true
    }

    func close() {
        isShown = false
    }

    func run(_ row: PaletteRow) {
        if row.closesOnRun { close() }
        row.run()
    }

    // MARK: rows

    /// The list on screen, whatever mode built it.
    var rows: [PaletteRow] {
        switch mode {
        case .commands, .git:
            return menuRows()
        case .files:
            return fileResults.map { path in
                PaletteRow(id: "file:\(path)", group: "Files", content: .file(path: path)) { [weak self] in
                    self?.onOpen?(path, nil)
                }
            }
        case .text:
            return matches.matches.map { match in
                PaletteRow(
                    id: "match:\(match.path):\(match.line):\(match.column)", group: match.path,
                    content: .match(path: match.path, line: match.line, text: match.text)
                ) { [weak self] in
                    self?.onOpen?(match.path, match.line)
                }
            }
        case .branches:
            return Self.filterBranches(branches, by: menuQuery).map { branch in
                PaletteRow(
                    id: "branch:\(branch.id)", group: branch.group, content: .branch(name: branch.name),
                    hint: branch.hint
                ) { [weak self] in
                    self?.onCheckout?(branch.ref)
                }
            }
        }
    }

    /// A menu's rows: the lists that hang off it, then its commands, all
    /// under the query. A query typed at the root searches every list
    /// too — folding the git actions behind a crumb is meant to tidy the
    /// list you land on, not to hide "Push" from someone who types it.
    private func menuRows() -> [PaletteRow] {
        let needle = menuQuery.trimmingCharacters(in: .whitespaces).lowercased()
        let reachesEverything = mode == .commands && !needle.isEmpty
        let openers = PaletteSubmenu.all
            .filter { $0.mode.parent == mode || reachesEverything }
            .map { submenu in
                PaletteRow(
                    id: "open:\(submenu.mode.rawValue)", group: submenu.group,
                    content: .command(label: submenu.label, symbol: submenu.symbol),
                    hint: submenu.hint, closesOnRun: false
                ) { [weak self] in
                    self?.show(submenu.mode)
                }
            }
        let openerKeywords = Dictionary(
            uniqueKeysWithValues: PaletteSubmenu.all.map { ("open:\($0.mode.rawValue)", $0.keywords) })
        let actions = commands
            .filter { ($0.submenu ?? .commands) == mode || reachesEverything }
            .map { command in
                PaletteRow(
                    id: "command:\(command.id)", group: command.group,
                    content: .command(label: command.label, symbol: command.symbol),
                    hint: command.hint, run: command.run)
            }
        let keywords = openerKeywords.merging(commands.map { ("command:\($0.id)", $0.keywords) }) { first, _ in first }
        let rows = openers + actions
        guard !needle.isEmpty else { return rows }
        return rows.lazy
            .compactMap { row -> (PaletteRow, Double)? in
                guard case .command(let label, _) = row.content else { return nil }
                let haystack = "\(label) \(keywords[row.id] ?? "") \(row.group)"
                return Self.fuzzyScore(haystack, needle).map { (row, $0) }
            }
            .sorted { $0.1 < $1.1 }
            .map(\.0)
    }

    // MARK: project

    /// A project came in or went stale — ⌘R, a switch — so the file list is
    /// read again on the next opening.
    func projectChanged() {
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
            let payload = try await client.files()
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
        isSearching = true
        grepTask = Task {
            try? await Task.sleep(for: Self.debounce)
            guard !Task.isCancelled else { return }
            do {
                let found = try await client.search(query, options: options, limit: Self.maximumMatches)
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

    /// Branches matching `query`, best first and capped. A blank query
    /// keeps them all: the list is short enough to read, unlike the files.
    static func filterBranches(_ branches: [PaletteBranch], by query: String) -> [PaletteBranch] {
        let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !needle.isEmpty else { return Array(branches.prefix(maximumBranchResults)) }
        return branches.lazy
            .compactMap { branch in fuzzyScore(branch.name, needle).map { (branch, $0) } }
            .sorted { $0.1 < $1.1 }
            .prefix(maximumBranchResults)
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
