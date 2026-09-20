// The History surface, laid out as the web app's history dock is: the
// filter bar along the top — the branch the log follows; the file it is
// narrowed to, when it is; a text or hash, with the regex and case toggles; an author; a date
// to start from; and Clear once anything narrows it — then the commits
// under it, newest first, each row its lane in the graph, its refs, its
// subject, its author and its date, with the next page pulled in as the
// list nears its end. A commit picked out of the list opens on the page
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
            HistoryFilterBar()
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
                                           range: range) { savedDetailsWidth = $0 }
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

/// A hairline down the leading edge of a column, dragged to give the
/// column more or less room — left for more. Measured in the window, as
/// the composer's handles are, since the handle moves with the edge it
/// drags.
private struct ColumnResizeHandle: View {
    @Binding var width: Double
    let range: ClosedRange<Double>
    let onRelease: (Double) -> Void
    @State private var startWidth: Double?

    var body: some View {
        Divider()
            .frame(width: 7)
            .contentShape(Rectangle())
            .onHover { hovering in
                if hovering { NSCursor.resizeLeftRight.push() } else { NSCursor.pop() }
            }
            .gesture(
                DragGesture(minimumDistance: 1, coordinateSpace: .global)
                    .onChanged { drag in
                        let start = startWidth ?? width
                        startWidth = start
                        var transaction = Transaction()
                        transaction.disablesAnimations = true
                        withTransaction(transaction) {
                            width = min(max(start - drag.translation.width, range.lowerBound), range.upperBound)
                        }
                    }
                    .onEnded { _ in
                        startWidth = nil
                        onRelease(width)
                    })
    }
}

/// The bar: the web history toolbar's controls, on the pane's own bar, each
/// in the pane's field shape. The text fields apply on Return and on losing
/// focus; the pickers, the toggles and the date apply at once.
private struct HistoryFilterBar: View {
    @Environment(AppModel.self) private var model
    @State private var grep = ""
    @State private var author = ""
    @State private var pickingDate = false

    private var history: CommitHistory { model.history }

    var body: some View {
        PaneBar {
            RefPicker()
            if let path = history.query.path {
                PathChip(path: path) { apply { $0.path = nil; $0.follow = false } }
            }
            GrepField(text: $grep, regex: history.query.regex, caseSensitive: history.query.caseSensitive,
                      commit: { apply { $0.grep = blank(grep) } },
                      toggleRegex: { apply { $0.grep = blank(grep); $0.regex.toggle() } },
                      toggleCase: { apply { $0.grep = blank(grep); $0.caseSensitive.toggle() } })
                .frame(minWidth: FilterWidths.picker, maxWidth: .infinity)
            FilterTextField(prompt: "User", text: $author) { apply { $0.author = blank(author) } }
                .frame(width: FilterWidths.narrow)
            SinceDateButton(after: history.query.after, presented: $pickingDate) { date in
                apply { $0.after = date }
            }
            if history.query.hasFilters {
                Button {
                    history.query = history.query.cleared
                } label: {
                    Label("Clear", systemImage: "xmark")
                        .font(.system(size: 11))
                }
                .buttonStyle(.accessoryBar)
            }
        }
        .onChange(of: history.query.grep, initial: true) { _, value in grep = value ?? "" }
        .onChange(of: history.query.author, initial: true) { _, value in author = value ?? "" }
    }

    private func apply(_ change: (inout LogQuery) -> Void) {
        var query = history.query
        change(&query)
        history.query = query
    }

    private func blank(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty ? nil : trimmed
    }
}

/// The widths the bar's fields are cut to, on one scale: the pickers and
/// the least the search gets — the search takes whatever the bar has left,
/// holding the two short fields, author and date, against the trailing
/// edge as a pair.
private enum FilterWidths {
    static let picker: CGFloat = 176
    static let narrow: CGFloat = 120
    static let chipName: CGFloat = 160
}

/// The ref the log follows: every branch, or one of them — folded by
/// folder, the way the switcher folds them — with the ref the log is on
/// listed even when it is no branch, a detached commit or a remote ref.
private struct RefPicker: View {
    @Environment(AppModel.self) private var model

    private var history: CommitHistory { model.history }
    private var current: String { history.effectiveRef }
    private var label: String { current == allRefs ? "All branches" : current }

    var body: some View {
        Menu {
            Button("All branches") { history.ref = allRefs }
            if current != allRefs, !model.branches.contains(where: { $0.name == current }) {
                Button(current) { history.ref = current }
            }
            Divider()
            ForEach(model.branches.map(BranchRef.init).groupedByFolder(), id: \.name) { folder in
                if let name = folder.name {
                    Menu(name) {
                        ForEach(folder.items, id: \.ref) { branch in
                            Button(branch.leaf) { history.ref = branch.ref }
                        }
                    }
                } else {
                    ForEach(folder.items, id: \.ref) { branch in
                        Button(branch.display) { history.ref = branch.ref }
                    }
                }
            }
        } label: {
            HStack(spacing: 5) {
                Image(systemName: current == allRefs ? "point.3.connected.trianglepath.dotted" : "arrow.triangle.branch")
                    .paneFieldGlyph()
                Text(label)
                    .font(.system(size: 11))
                    .lineLimit(1)
                    .truncationMode(.middle)
                Spacer(minLength: 0)
                MenuChevron()
            }
            .paneField()
            .frame(width: FilterWidths.picker)
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .help("Branch")
    }
}

/// The up-and-down chevron a picker on the bar ends in, held at the
/// field's trailing edge whatever the pick's length.
private struct MenuChevron: View {
    var body: some View {
        Image(systemName: "chevron.up.chevron.down")
            .font(.system(size: 8, weight: .semibold))
            .foregroundStyle(.secondary)
    }
}

/// The file the log is narrowed to, wearing its own type icon, with the
/// mark that widens the log to every file again. The chip hugs its
/// content — sized to the bar it would centre the name in a wide box —
/// with only the name capped, so a long one truncates in the middle.
private struct PathChip: View {
    let path: String
    let clear: () -> Void

    var body: some View {
        HStack(spacing: 5) {
            FileIconView(path: path)
                .frame(width: 12, height: 12)
            Text(path.split(separator: "/").last.map(String.init) ?? path)
                .font(.system(size: 11))
                .lineLimit(1)
                .truncationMode(.middle)
                .frame(maxWidth: FilterWidths.chipName)
            Button(action: clear) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 11))
                    .foregroundStyle(.tertiary)
            }
            .buttonStyle(.plain)
            .help("Show all files")
        }
        .paneField()
        .fixedSize(horizontal: true, vertical: false)
        .help("History of \(path)")
    }
}

/// A text or hash to look for, with the web bar's two toggles at its
/// trailing edge — `.*` for a regular expression, `Cc` to match case.
private struct GrepField: View {
    @Binding var text: String
    let regex: Bool
    let caseSensitive: Bool
    let commit: () -> Void
    let toggleRegex: () -> Void
    let toggleCase: () -> Void
    @FocusState private var focused: Bool

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: "magnifyingglass")
                .paneFieldGlyph()
            TextField("Text or hash", text: $text)
                .textFieldStyle(.plain)
                .font(.system(size: 11))
                .focused($focused)
                .onSubmit(commit)
                .onChange(of: focused) { _, isFocused in if !isFocused { commit() } }
            HStack(spacing: 2) {
                FilterToggle(label: ".*", help: "Regular expression", isOn: regex, action: toggleRegex)
                FilterToggle(label: "Cc", help: "Match case", isOn: caseSensitive, action: toggleCase)
            }
        }
        .paneField()
    }
}

private struct FilterToggle: View {
    let label: String
    let help: String
    let isOn: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 10, weight: .medium, design: .monospaced))
                .foregroundStyle(isOn ? Color.white : Color.secondary)
                .frame(width: 20, height: 16)
                .background(isOn ? Color.accentColor : Color.clear, in: RoundedRectangle(cornerRadius: 4))
        }
        .buttonStyle(.plain)
        .help(help)
    }
}

/// A plain filter field on the bar, applied on Return and on losing focus.
private struct FilterTextField: View {
    let prompt: String
    @Binding var text: String
    let commit: () -> Void
    @FocusState private var focused: Bool

    var body: some View {
        TextField(prompt, text: $text)
            .textFieldStyle(.plain)
            .font(.system(size: 11))
            .focused($focused)
            .onSubmit(commit)
            .onChange(of: focused) { _, isFocused in if !isFocused { commit() } }
            .paneField()
    }
}

/// The date the log starts from, as a chip that opens a calendar; set, it
/// names the day, and the calendar carries the mark that unsets it.
private struct SinceDateButton: View {
    let after: String?
    @Binding var presented: Bool
    let pick: (String?) -> Void

    @MainActor private static let wire: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private var date: Date? { after.flatMap(Self.wire.date(from:)) }

    var body: some View {
        Button {
            presented = true
        } label: {
            HStack(spacing: 5) {
                Image(systemName: "calendar")
                    .paneFieldGlyph()
                Text(date.map { $0.formatted(date: .abbreviated, time: .omitted) } ?? "Since date")
                    .font(.system(size: 11))
                    .foregroundStyle(date == nil ? .secondary : .primary)
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .paneField()
            .frame(width: FilterWidths.narrow)
        }
        .buttonStyle(.plain)
        .help("Since date")
        .popover(isPresented: $presented, arrowEdge: .bottom) {
            VStack(spacing: 8) {
                DatePicker("Since", selection: Binding(
                    get: { date ?? Date() },
                    set: { pick(Self.wire.string(from: $0)); presented = false }
                ), displayedComponents: .date)
                .datePickerStyle(.graphical)
                .labelsHidden()
                if after != nil {
                    Button("Clear Date") { pick(nil); presented = false }
                        .controlSize(.small)
                }
            }
            .padding(10)
        }
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
                ForEach(Array(commits.enumerated()), id: \.element.sha) { index, commit in
                    CommitRow(commit: commit, graph: layout.rows[index],
                              selected: commit.sha == history.selectedSha) { select(commit) }
                        .id(commit.sha)
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 0, leading: PaneMetrics.barInset, bottom: 0, trailing: PaneMetrics.barInset))
                        .onAppear {
                            if commit.sha == commits.last?.sha { history.loadMore() }
                        }
                }
                if !commits.isEmpty && history.hasMore {
                    Text("Loading older commits…")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, PaneMetrics.barInset)
                        .listRowSeparator(.hidden)
                }
            }
            .listStyle(.inset)
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
                    ProgressView()
                        .controlSize(.small)
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
/// badges, its subject, and
/// at the trailing edge its author and the day it was authored, each in a
/// column of its own so the dates stand in one line down the list whatever
/// the authors' names run to.
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
            .padding(.horizontal, 6)
            .frame(height: CommitGraphLayout.rowHeight)
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
            .background(.quaternary.opacity(0.7), in: RoundedRectangle(cornerRadius: 4))
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
