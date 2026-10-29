// The History surface, laid out as the web app's history dock is: the
// commits, newest first, each row its lane in the graph, its refs, its
// subject, its author and its date, with the next page pulled in as the
// list nears its end. What the log follows and is narrowed by stands on
// the bar over it (see `HistoryBar`) — the repository, the branch, the
// filter menu and the search over messages — and whatever narrows it
// besides the search is said once more over the list, as Finder's scope
// bar says where a search is looking, each with its own way out (see
// `HistoryScopeBar`). A commit picked out of the list opens on the page
// and its details stand beside the list — see `CommitDetails`.
import SwiftUI

struct HistoryPane: View {
    @Environment(AppModel.self) private var model
    // The width the details column was last dragged to, or none until it
    // has been: opened fresh, it takes a share of the pane instead, so a
    // wide window shows the file tree without truncating its paths while
    // a narrow one still leaves the list room. HSplitView can't do this —
    // it sizes its columns once, before the pane has a width to share.
    // The live width during a drag is state; the defaults get it on release.
    @AppStorage("history-details-width") private var savedDetailsWidth = 0.0
    @State private var draggedDetailsWidth: Double?

    private var history: CommitHistory { model.history }

    var body: some View {
        VStack(spacing: 0) {
            HistoryBar()
            if history.query.narrowsBeyondSearch {
                HistoryScopeBar()
            }
            GeometryReader { proxy in
                let range = Self.detailsRange(in: proxy.size.width)
                let width = detailsWidth(in: proxy.size.width, range: range)
                HStack(spacing: 0) {
                    CommitList()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    // CommitDetails uses a missing loaded detail as its loading state. Keep
                    // the column out of the layout until a commit is selected so an empty
                    // history shows neither a permanent spinner nor unused column space.
                    if history.selectedSha != nil {
                        ColumnResizeHandle(width: Binding(get: { width }, set: { draggedDetailsWidth = $0 }),
                                           range: range, edge: .leading) { savedDetailsWidth = $0 }
                        CommitDetails()
                            .frame(width: width)
                            .frame(maxHeight: .infinity)
                    }
                }
            }
        }
    }

    private func detailsWidth(in paneWidth: CGFloat, range: ClosedRange<Double>) -> Double {
        let wanted = draggedDetailsWidth
            ?? (savedDetailsWidth > 0 ? savedDetailsWidth : paneWidth * Self.detailsShare)
        return min(max(wanted, range.lowerBound), range.upperBound)
    }

    private static let detailsMinWidth = 280.0
    private static let listMinWidth = 320.0
    private static let detailsShare = 0.36

    private static func detailsRange(in paneWidth: CGFloat) -> ClosedRange<Double> {
        detailsMinWidth...max(detailsMinWidth, paneWidth - listMinWidth)
    }
}

/// The bar over the log: the repository and the branch it is of, the
/// filter menu, and at the trailing edge the search over messages, which
/// applies on Return, on the field letting the keys go and on clearing.
private struct HistoryBar: View {
    @Environment(AppModel.self) private var model
    @State private var text = ""

    private var history: CommitHistory { model.history }

    var body: some View {
        PaneBar {
            PaneGlassGroup {
                if model.roots.count > 1 {
                    RepositoryPicker(look: .bar)
                    PaneGlassDivider()
                }
                RefPicker()
                PaneGlassDivider()
                HistoryFilterMenu()
            }
            Spacer(minLength: 0)
            PaneFilterField(prompt: "Search commit messages", text: $text, submit: search)
        }
        .onAppear { text = history.query.grep ?? "" }
        .onChange(of: history.query.grep) { _, grep in text = grep ?? "" }
    }

    private func search() {
        let needle = text.trimmingCharacters(in: .whitespaces)
        history.query.grep = needle.isEmpty ? nil : needle
    }
}

/// The longest a branch's name runs on the bar before it is cut.
private let refNameWidth: CGFloat = 160

/// The ref the log follows: every branch, or one of them — the same
/// `BranchPopover` the sidebar's pickers open, with "All branches" at its
/// head and the ref the log is on listed even when it is no branch, a
/// detached commit or a remote ref.
private struct RefPicker: View {
    @Environment(AppModel.self) private var model
    @State private var open = false

    private var history: CommitHistory { model.history }
    private var current: String { history.effectiveRef }
    private var label: String { current == allRefs ? "All branches" : current }

    var body: some View {
        PaneBarPopUp(title: label, help: "Branch", maxWidth: refNameWidth) {
            Image(systemName: current == allRefs ? "point.3.connected.trianglepath.dotted" : "arrow.triangle.branch")
                .foregroundStyle(.secondary)
        } action: {
            open.toggle()
        }
        .popover(isPresented: $open, arrowEdge: .bottom) {
            BranchPopover(sections: sections, placeholder: "Search branches", pick: { choice in
                history.ref = choice.branch?.ref ?? choice.id
            }, dismiss: { open = false })
        }
        .closesOnNavigation($open)
    }

    private var sections: [BranchChoiceSection] {
        var answers = [BranchChoice.answer(
            id: allRefs, title: "All branches", symbol: "point.3.connected.trianglepath.dotted", checked: current == allRefs)]
        if current != allRefs, !model.branches.contains(where: { $0.name == current }) {
            answers.append(.answer(id: current, title: current, symbol: "arrow.triangle.branch", checked: true))
        }
        return [
            BranchChoiceSection(id: "answers", title: nil, rows: answers, hiddenWhileSearching: true),
            BranchChoiceSection(
                id: "local", title: "Local",
                rows: model.branches.map { .branch(BranchRef($0), checked: $0.name == current) }),
        ]
    }
}

/// The filters the search leaves out, in the system's own menu: an author
/// picked from the ones in the log, a day to start from — a span back
/// from today, or one picked on a calendar — and how the search matches.
/// The glyph fills while anything here narrows the log.
private struct HistoryFilterMenu: View {
    @Environment(AppModel.self) private var model
    @State private var pickingDate = false

    private var history: CommitHistory { model.history }
    private var query: LogQuery { history.query }
    private var active: Bool { query.author != nil || query.after != nil || query.regex || query.caseSensitive }

    var body: some View {
        Menu {
            Picker("Author", selection: binding(\.author)) {
                Text("Any Author").tag(String?.none)
                Divider()
                ForEach(authors, id: \.self) { Text($0).tag(Optional($0)) }
            }
            Menu("Since") {
                Picker("Since", selection: binding(\.after)) {
                    Text("Any Time").tag(String?.none)
                    Divider()
                    ForEach(SinceSpan.allCases) { span in
                        Text(span.title).tag(Optional(span.after))
                    }
                    if let after = query.after, !SinceSpan.allCases.contains(where: { $0.after == after }) {
                        Divider()
                        Text(SinceSpan.title(of: after)).tag(Optional(after))
                    }
                }
                .pickerStyle(.inline)
                .labelsHidden()
                Divider()
                Button("Choose a Date…") { pickingDate = true }
            }
            Divider()
            Toggle("Regular Expression", isOn: binding(\.regex))
            Toggle("Match Case", isOn: binding(\.caseSensitive))
            Divider()
            Button("Clear Filters") { history.query = query.cleared }
                .disabled(!query.hasFilters)
        } label: {
            Image(systemName: active ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(active ? Color(nsColor: IslandPalette.accent) : .secondary)
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .glassCircleControl()
        .fixedSize()
        .controlTooltip("Filter")
        .popover(isPresented: $pickingDate, arrowEdge: .bottom) {
            SinceCalendar(after: query.after) { after in
                pickingDate = false
                history.query.after = after
            }
        }
    }

    /// The authors in the log as far as it has been read, the most
    /// prolific first, and the one the log is narrowed to whatever it is.
    private var authors: [String] {
        var counts: [String: Int] = [:]
        for commit in history.commits { counts[commit.author, default: 0] += 1 }
        var authors = counts.sorted { $0.value == $1.value ? $0.key < $1.key : $0.value > $1.value }
            .prefix(20).map(\.key)
        if let author = query.author, !authors.contains(author) { authors.insert(author, at: 0) }
        return authors
    }

    private func binding<Value>(_ key: WritableKeyPath<LogQuery, Value>) -> Binding<Value> {
        Binding(get: { history.query[keyPath: key] }, set: { history.query[keyPath: key] = $0 })
    }
}

/// The spans back from today the Since menu offers, each as the day it
/// starts from in the form the server reads.
private enum SinceSpan: CaseIterable, Identifiable {
    case day, week, month, halfYear, year

    var id: Self { self }

    var title: String {
        switch self {
        case .day: return "Last 24 Hours"
        case .week: return "Last 7 Days"
        case .month: return "Last 30 Days"
        case .halfYear: return "Last 6 Months"
        case .year: return "Last Year"
        }
    }

    @MainActor
    var after: String {
        let calendar = Calendar.current
        let now = Date()
        let start: Date? = switch self {
        case .day: calendar.date(byAdding: .day, value: -1, to: now)
        case .week: calendar.date(byAdding: .day, value: -7, to: now)
        case .month: calendar.date(byAdding: .day, value: -30, to: now)
        case .halfYear: calendar.date(byAdding: .month, value: -6, to: now)
        case .year: calendar.date(byAdding: .year, value: -1, to: now)
        }
        return SinceCalendar.wire.string(from: start ?? now)
    }

    /// A day picked on the calendar, as the menu and the scope bar name it.
    @MainActor
    static func title(of after: String) -> String {
        guard let date = SinceCalendar.wire.date(from: after) else { return after }
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}

/// The calendar a day to start from is picked on.
private struct SinceCalendar: View {
    let after: String?
    let pick: (String?) -> Void

    @MainActor static let wire: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    var body: some View {
        DatePicker("Since", selection: Binding(
            get: { after.flatMap(Self.wire.date(from:)) ?? Date() },
            set: { pick(Self.wire.string(from: $0)) }
        ), in: ...Date(), displayedComponents: .date)
        .datePickerStyle(.graphical)
        .labelsHidden()
        .padding(10)
    }
}

/// What narrows the log besides the search, said over the list while
/// anything does: each as a token naming what it narrows by, with the mark
/// that takes it back out, and Clear at the trailing edge for all of them.
private struct HistoryScopeBar: View {
    @Environment(AppModel.self) private var model

    private var history: CommitHistory { model.history }

    var body: some View {
        PaneBar {
            ForEach(tokens) { token in
                ScopeToken(token: token) { history.query = token.removing(from: history.query) }
            }
            Spacer(minLength: 0)
            Button("Clear") { history.query = history.query.cleared }
                .font(.system(size: 11))
                .buttonStyle(PaneBarButtonStyle())
        }
    }

    private var tokens: [Scope] {
        let query = history.query
        var tokens: [Scope] = []
        if let path = query.path {
            tokens.append(Scope(id: "file", kind: "File", value: (path as NSString).lastPathComponent,
                                help: "History of \(path)", symbol: "doc") {
                $0.path = nil
                $0.follow = false
            })
        }
        if let author = query.author {
            tokens.append(Scope(id: "author", kind: "Author", value: author, help: author, symbol: "person") {
                $0.author = nil
            })
        }
        if let after = query.after {
            let title = SinceSpan.allCases.first { $0.after == after }?.title ?? SinceSpan.title(of: after)
            tokens.append(Scope(id: "since", kind: "Since", value: title, help: "Commits since \(after)",
                                symbol: "calendar") {
                $0.after = nil
            })
        }
        if query.regex {
            tokens.append(Scope(id: "regex", kind: "Match", value: "Regular expression", help: "The search is a regular expression",
                                symbol: "asterisk") { $0.regex = false })
        }
        if query.caseSensitive {
            tokens.append(Scope(id: "case", kind: "Match", value: "Case", help: "The search matches case",
                                symbol: "textformat") { $0.caseSensitive = false })
        }
        return tokens
    }
}

/// One thing the log is narrowed by, as the scope bar shows it.
private struct Scope: Identifiable {
    let id: String
    let kind: String
    let value: String
    let help: String
    let symbol: String
    let remove: (inout LogQuery) -> Void

    func removing(from query: LogQuery) -> LogQuery {
        var query = query
        remove(&query)
        return query
    }
}

/// A token of the scope bar: what it narrows by over its value, in a
/// capsule tinted with the accent as the system's search tokens are, and
/// the mark that takes it back out.
private struct ScopeToken: View {
    let token: Scope
    let remove: () -> Void
    @State private var hovering = false

    var body: some View {
        let accent = Color(nsColor: IslandPalette.accent)
        HStack(spacing: 5) {
            Image(systemName: token.symbol)
                .font(.system(size: 10, weight: .medium))
            Text(token.kind)
                .foregroundStyle(accent.opacity(0.8))
            Text(token.value)
                .fontWeight(.medium)
                .lineLimit(1)
                .truncationMode(.middle)
                .frame(maxWidth: 180)
            Button(action: remove) {
                Image(systemName: "xmark")
                    .font(.system(size: 8, weight: .bold))
                    .frame(width: 14, height: 14)
                    .background(Circle().fill(accent.opacity(hovering ? 0.25 : 0)))
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .onHover { hovering = $0 }
            .help("Remove")
            .accessibilityLabel("Remove \(token.kind) \(token.value)")
        }
        .font(.system(size: 11))
        .foregroundStyle(accent)
        .padding(.leading, 8)
        .padding(.trailing, 4)
        .frame(height: 20)
        .background(accent.opacity(0.14), in: Capsule())
        .fixedSize()
        .help(token.help)
    }
}

private extension LogQuery {
    /// Whether anything narrows the log that the search field does not
    /// already show.
    var narrowsBeyondSearch: Bool {
        path != nil || author != nil || after != nil || regex || caseSensitive
    }
}

/// A row of the list, in the same column as the bar's fields above it, on
/// both edges: the row is the width of a field, and the graph's own half
/// column of air at the leading edge stands the dots where the fields stand
/// their glyphs. The inset is the row's own padding rather than
/// `listRowInsets`, which the list adds its margins to.
private extension View {
    func rowInset() -> some View {
        padding(.horizontal, PaneMetrics.barInset)
    }
}

/// The commits: one row each, the graph's cell down the leading edge. The
/// list paints its own pick, in `TreeSelection`'s wash, since a selecting
/// `List` would paint the accent blue; Up and Down still walk the rows.
private struct CommitList: View {
    @Environment(AppModel.self) private var model

    private var history: CommitHistory { model.history }

    var body: some View {
        let commits = history.commits
        let layout = history.graph
        ScrollViewReader { scroller in
            List {
                ListEdgeSpacer()
                ForEach(Array(commits.enumerated()), id: \.element.sha) { index, commit in
                    CommitRow(commit: commit, graph: layout.rows[index],
                              selected: commit.sha == history.selectedSha) { select(commit) }
                        .id(commit.sha)
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets())
                        .onAppear {
                            if commit.sha == commits.last?.sha { history.loadMore() }
                        }
                }
                if !commits.isEmpty && history.hasMore {
                    Text("Loading older commits…")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .rowInset()
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets())
                }
                ListEdgeSpacer()
            }
            .listStyle(.plain)
            .environment(\.defaultMinListRowHeight, 0)
            .contentMargins(.horizontal, 0, for: .scrollContent)
            .scrollContentBackground(.hidden)
            .focusable()
            .focusEffectDisabled()
            .onMoveCommand { direction in
                guard let commit = neighbour(direction) else { return }
                select(commit)
                scroller.scrollTo(commit.sha)
            }
        }
        .overlay {
            if commits.isEmpty {
                if history.isLoading {
                    Orb(size: 16, label: "Loading")
                } else if let error = history.loadError {
                    PanePlaceholder("Could not load the history", symbol: "exclamationmark.triangle", detail: error)
                } else {
                    PanePlaceholder("No commits match the current filters", symbol: "clock.arrow.circlepath")
                }
            }
        }
    }

    /// A commit picked is the commit shown: the details beside the list,
    /// and the page on its diff.
    private func select(_ commit: CommitInfo) {
        history.selectedSha = commit.sha
        model.show(commit: commit)
    }

    private func neighbour(_ direction: MoveCommandDirection) -> CommitInfo? {
        let commits = history.commits
        guard let current = commits.firstIndex(where: { $0.sha == history.selectedSha }) else {
            return direction == .down ? commits.first : nil
        }
        switch direction {
        case .up: return current > 0 ? commits[current - 1] : nil
        case .down: return current + 1 < commits.count ? commits[current + 1] : nil
        default: return nil
        }
    }
}

/// A commit's row: its cell of the graph, up to three of its refs as
/// badges, its subject, and at the trailing edge its author and the day it
/// was authored, each in a column of its own so the dates stand in one line
/// down the list whatever the authors' names run to. `rowInset` sets the
/// column the content stands in, and the pick is washed across the inset
/// too, so the wash runs edge to edge with the fields above.
private struct CommitRow: View {
    let commit: CommitInfo
    let graph: GraphRow
    let selected: Bool
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            HStack(spacing: 8) {
                GraphCell(row: graph)
                ForEach(commit.refs.prefix(3), id: \.self) { ref in
                    RefBadge(ref: ref)
                }
                Text(commit.subject)
                    .font(.system(size: 12))
                    .lineLimit(1)
                    .truncationMode(.tail)
                Spacer(minLength: 8)
                Text(commit.author)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .frame(maxWidth: Self.authorWidth, alignment: .trailing)
                Text(CommitDates.day(commit.authoredAt))
                    .font(.system(size: 11).monospacedDigit())
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .frame(width: Self.dayWidth, alignment: .trailing)
            }
            .frame(height: CommitGraphLayout.rowHeight)
            .rowInset()
            .background(selected ? TreeSelection.color : Color.clear, in: RoundedRectangle(cornerRadius: 5))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private static let authorWidth: CGFloat = 160
    private static let dayWidth: CGFloat = 44
}

/// A ref a commit carries, as the small badge the web list wears.
struct RefBadge: View {
    let ref: String

    var body: some View {
        Text(ref)
            .font(.system(size: 10))
            .lineLimit(1)
            .padding(.horizontal, 4)
            .padding(.vertical, 1)
            .background(.quaternaryWash(0.7), in: RoundedRectangle(cornerRadius: 4))
    }
}

/// The dates the server sends, ISO strings, read for display only.
@MainActor
enum CommitDates {
    private static let iso: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let plain = ISO8601DateFormatter()

    static func parse(_ value: String) -> Date? {
        iso.date(from: value) ?? plain.date(from: value)
    }

    /// `Sep 18`, the way the list dates a row.
    static func day(_ value: String) -> String {
        guard let date = parse(value) else { return "" }
        return date.formatted(.dateTime.month(.abbreviated).day())
    }

    /// `Sep 18, 2026, 10:42`, the way the details date a commit.
    static func dateTime(_ value: String) -> String {
        guard let date = parse(value) else { return "" }
        return date.formatted(date: .abbreviated, time: .shortened)
    }
}
