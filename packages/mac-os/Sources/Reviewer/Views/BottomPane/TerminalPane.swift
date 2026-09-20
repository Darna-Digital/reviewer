// The Terminal surface, laid out as the opener is: the project's shells as
// the system's own table down the left — title and when it was last used —
// sortable on either column and striped as Finder's rows are, newest first
// to begin with, under a toolbar with open and close grouped at its
// leading edge and a search at its trailing edge. With nothing to list the
// table gives way to a placeholder, header and all. A click picks a
// session; a double-click, Return or the row's menu renames it in place,
// the way Finder renames a file; Delete closes it. The selected one's live
// terminal stands on the right under a bar of the toolbar's height naming
// it. Every shell visited stays attached while hidden, so coming back is
// the screen as you left it.
import Observation
import SwiftTerm
import SwiftUI

struct TerminalPane: View {
    @Environment(AppModel.self) private var model
    @State private var rename = ThreadRename()

    var body: some View {
        HSplitView {
            ThreadTable()
                .frame(minWidth: PaneMetrics.tableMinWidth, idealWidth: PaneMetrics.tableIdealWidth,
                       maxWidth: PaneMetrics.tableMaxWidth)
            ThreadTerminal()
                .frame(minWidth: 240, maxWidth: .infinity, maxHeight: .infinity)
        }
        .environment(rename)
        .task { await model.threads.load() }
    }
}

/// Which session is being renamed, and the title typed so far — shared by
/// the table, where the field is, and the detail bar, whose rename button
/// opens it.
@MainActor
@Observable
private final class ThreadRename {
    var id: String?
    var draft = ""

    func begin(_ thread: ThreadSummary) {
        draft = thread.title
        id = thread.id
    }

    func cancel() {
        id = nil
    }

    /// The new title, if the rename is worth sending: typed, and changed.
    func finish(_ thread: ThreadSummary) -> String? {
        guard id == thread.id else { return nil }
        id = nil
        let trimmed = draft.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, trimmed != thread.title else { return nil }
        return trimmed
    }
}

private struct ThreadTable: View {
    @Environment(AppModel.self) private var model
    @State private var query = ""
    @State private var sortOrder = [KeyPathComparator(\ThreadRow.updatedOrder, order: .reverse)]
    @Environment(ThreadRename.self) private var rename

    private var threads: Threads { model.threads }

    private var rows: [ThreadRow] {
        let needle = query.trimmingCharacters(in: .whitespaces)
        let shells = threads.threads.filter { $0.agent == "terminal" }.map(ThreadRow.init)
        let matched = needle.isEmpty
            ? shells
            : shells.filter {
                $0.title.localizedCaseInsensitiveContains(needle)
            }
        return matched.sorted(using: sortOrder)
    }

    var body: some View {
        VStack(spacing: 0) {
            toolbar
            if rows.isEmpty && !threads.isLoading {
                placeholder
            } else {
                table
            }
        }
    }

    @ViewBuilder
    private var placeholder: some View {
        if query.isEmpty {
            PanePlaceholder("No Sessions", symbol: "terminal",
                            detail: "Open a shell in this project.") {
                Button("New Session", action: open)
            }
        } else {
            PanePlaceholder("No sessions match “\(query)”", symbol: "magnifyingglass")
        }
    }

    private var toolbar: some View {
        PaneToolbar {
            ControlGroup {
                Button(action: open) { Label("New Session", systemImage: "plus") }
                    .help("New session")
                Button(action: closeSelected) { Label("Close Session", systemImage: "minus") }
                    .help("Close the selected session")
                    .disabled(threads.selected == nil)
            }
            Spacer(minLength: 8)
            PaneSearchField(prompt: "Search", text: $query)
                .frame(width: PaneMetrics.toolbarSearchWidth)
        }
    }

    private var table: some View {
        Table(rows, selection: selection, sortOrder: $sortOrder) {
            TableColumn("Name", value: \.title) { row in
                HStack(spacing: 8) {
                    Image(systemName: "terminal")
                        .foregroundStyle(.secondary)
                        .frame(width: 16)
                    if rename.id == row.id {
                        @Bindable var rename = rename
                        RenameField(text: $rename.draft) {
                            commitRename(row.thread)
                        } cancel: {
                            rename.cancel()
                        }
                    } else {
                        Text(row.title)
                            .lineLimit(1)
                            .truncationMode(.tail)
                    }
                }
            }
            .width(min: 160, ideal: 280)
            TableColumn("Last Used", value: \.updatedOrder) { row in
                Text(row.updated.map(OpenerDates.format) ?? "—")
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .width(min: 120, ideal: 160)
        }
        .tableStyle(.inset(alternatesRowBackgrounds: true))
        .scrollContentBackground(.hidden)
        .contextMenu(forSelectionType: String.self) { ids in
            if let thread = ids.first.flatMap(thread(for:)) {
                Button("Rename") { rename.begin(thread) }
                Divider()
                Button("Close Session", role: .destructive) {
                    Task { await threads.close(id: thread.id) }
                }
            }
        } primaryAction: { ids in
            if let thread = ids.first.flatMap(thread(for:)) { rename.begin(thread) }
        }
        .onKeyPress(.return) {
            guard rename.id == nil, let thread = threads.selected else { return .ignored }
            rename.begin(thread)
            return .handled
        }
        .onDeleteCommand(perform: closeSelected)
    }

    private func thread(for id: String) -> ThreadSummary? {
        threads.threads.first { $0.id == id }
    }

    private func commitRename(_ thread: ThreadSummary) {
        guard let title = rename.finish(thread) else { return }
        Task { await threads.rename(id: thread.id, to: title) }
    }

    private func open() {
        Task { await threads.open(branch: model.currentBranch) }
    }

    private func closeSelected() {
        guard rename.id == nil, let id = threads.selectedId else { return }
        Task { await threads.close(id: id) }
    }

    private var selection: Binding<String?> {
        Binding(get: { threads.selectedId }, set: { threads.selectedId = $0 })
    }
}

/// The field a row's name turns into while it is being renamed: focused
/// as soon as it appears, Return keeps the new name, Escape drops it, and
/// clicking away keeps it too, as Finder does.
private struct RenameField: View {
    @Binding var text: String
    let commit: () -> Void
    let cancel: () -> Void
    @FocusState private var focused: Bool

    var body: some View {
        TextField("Title", text: $text)
            .textFieldStyle(.plain)
            .focused($focused)
            .onSubmit(commit)
            .onExitCommand(perform: cancel)
            .onChange(of: focused) { _, isFocused in
                if !isFocused { commit() }
            }
            .task { focused = true }
    }
}

private struct ThreadTerminal: View {
    @Environment(AppModel.self) private var model
    @Environment(ThreadRename.self) private var rename

    var body: some View {
        if let thread = model.threads.selected {
            VStack(spacing: 0) {
                bar(for: thread)
                let stream = model.threads.stream(for: thread.id)
                TerminalWell {
                    TerminalHost(view: stream.view)
                        .id(ObjectIdentifier(stream))
                }
            }
        } else {
            PanePlaceholder("No Session Open", symbol: "terminal",
                            detail: "Pick a session on the left, or open a new one.") {
                Button("New Session") { Task { await model.threads.open(branch: model.currentBranch) } }
            }
        }
    }

    private func bar(for thread: ThreadSummary) -> some View {
        PaneToolbar {
            Image(systemName: "terminal")
                .foregroundStyle(.secondary)
            Text(thread.displayTitle)
                .fontWeight(.medium)
                .lineLimit(1)
            Spacer(minLength: 8)
            Button { rename.begin(thread) } label: {
                Label("Rename", systemImage: "pencil")
            }
            .help("Rename")
            .disabled(rename.id == thread.id)
        }
    }
}

/// A session as the table lists it: the summary with the strings the
/// columns show and sort on, and its last use parsed once as a date.
private struct ThreadRow: Identifiable, Hashable {
    let thread: ThreadSummary
    let updated: Date?

    var id: String { thread.id }
    var title: String { thread.displayTitle }
    /// A session never used sorts after every one that was.
    var updatedOrder: Date { updated ?? .distantPast }

    @MainActor
    init(_ thread: ThreadSummary) {
        self.thread = thread
        updated = CommitDates.parse(thread.updatedAt)
    }
}

private extension ThreadSummary {
    var displayTitle: String { title.isEmpty ? "Terminal" : title }
}

struct TerminalHost: NSViewRepresentable {
    let view: TerminalView

    func makeNSView(context: Context) -> TerminalView { view }
    func updateNSView(_ nsView: TerminalView, context: Context) {}
}
