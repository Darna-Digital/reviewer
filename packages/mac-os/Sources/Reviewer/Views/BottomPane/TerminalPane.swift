// The Terminal surface, laid out as the web app's Terminal sessions are: a
// source list of the project's shells down the left — a filter over them
// on a bar above, open and close in the footer — and the selected one's
// live terminal on the right, under a bar of the same height naming it and
// its branch that turns into a field to rename it, so the rule under the
// filter runs on into the rule under the title. Every shell visited stays attached while
// hidden, so coming back is the screen as you left it.
import SwiftTerm
import SwiftUI

struct TerminalPane: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        HSplitView {
            ThreadList()
                .frame(minWidth: PaneMetrics.listMinWidth, idealWidth: PaneMetrics.listIdealWidth,
                       maxWidth: PaneMetrics.listMaxWidth)
            ThreadTerminal()
                .frame(minWidth: 240, maxWidth: .infinity, maxHeight: .infinity)
        }
        .task { await model.threads.load() }
    }
}

private struct ThreadList: View {
    @Environment(AppModel.self) private var model
    @State private var query = ""

    private var threads: Threads { model.threads }

    private var shells: [ThreadSummary] {
        let needle = query.trimmingCharacters(in: .whitespaces)
        let all = threads.threads.filter { $0.agent == "terminal" }
        guard !needle.isEmpty else { return all }
        return all.filter {
            $0.title.localizedCaseInsensitiveContains(needle)
                || ($0.lastCommand ?? "").localizedCaseInsensitiveContains(needle)
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            PaneBar {
                PaneFilterField(prompt: "Filter sessions", text: $query, size: .small)
            }
            List(selection: selection) {
                ForEach(shells) { thread in
                    ThreadRow(thread: thread)
                        .tag(thread.id)
                        .listRowInsets(EdgeInsets(top: 2, leading: PaneMetrics.barInset, bottom: 2, trailing: PaneMetrics.barInset))
                        .contextMenu {
                            Button("Close Session", role: .destructive) {
                                Task { await threads.close(id: thread.id) }
                            }
                        }
                }
            }
            .listStyle(.inset)
            .scrollContentBackground(.hidden)
            .overlay {
                if shells.isEmpty && !threads.isLoading {
                    if query.isEmpty {
                        PanePlaceholder("No sessions", symbol: "terminal",
                                        detail: "Open a shell in this project.") {
                            Button("New Session") { open() }
                        }
                    } else {
                        PanePlaceholder("No matches", symbol: "magnifyingglass")
                    }
                }
            }
            PaneFooter {
                PaneBarButton(symbol: "plus", help: "New session") { open() }
                PaneBarButton(symbol: "minus", help: "Close the selected session") {
                    guard let id = threads.selectedId else { return }
                    Task { await threads.close(id: id) }
                }
                .disabled(threads.selected == nil)
                Spacer(minLength: 0)
            }
        }
    }

    private func open() {
        Task { await threads.open(branch: model.currentBranch) }
    }

    private var selection: Binding<String?> {
        Binding(get: { threads.selectedId }, set: { threads.selectedId = $0 })
    }
}

/// A session's row: its title over the last command it ran — or its
/// branch, before it has run one — and a close mark under the pointer.
private struct ThreadRow: View {
    let thread: ThreadSummary
    @Environment(AppModel.self) private var model
    @State private var isHovering = false

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "terminal")
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
                .frame(width: 16)
            VStack(alignment: .leading, spacing: 1) {
                Text(thread.displayTitle)
                    .font(.system(size: 13))
                    .lineLimit(1)
                Text(thread.lastCommand ?? thread.branch)
                    .font(.system(size: 11, design: thread.lastCommand == nil ? .default : .monospaced))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            Spacer(minLength: 4)
            if isHovering {
                PaneBarButton(symbol: "xmark", help: "Close session") {
                    Task { await model.threads.close(id: thread.id) }
                }
            }
        }
        .frame(height: 30)
        .contentShape(Rectangle())
        .onHover { isHovering = $0 }
    }
}

private struct ThreadTerminal: View {
    @Environment(AppModel.self) private var model
    @State private var renaming = false
    @State private var title = ""
    @FocusState private var titleFocused: Bool

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
            .onChange(of: thread.id) { _, _ in renaming = false }
        } else {
            PanePlaceholder("No session open", symbol: "terminal",
                            detail: "Pick a session on the left, or open a new one.") {
                Button("New Session") { Task { await model.threads.open(branch: model.currentBranch) } }
            }
        }
    }

    private func bar(for thread: ThreadSummary) -> some View {
        PaneBar {
            Image(systemName: "terminal")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
            if renaming {
                TextField("Title", text: $title)
                    .textFieldStyle(.plain)
                    .font(.system(size: 11))
                    .focused($titleFocused)
                    .onSubmit { commitRename(thread) }
                    .onExitCommand { renaming = false }
                    .paneField()
                    .frame(maxWidth: 280)
            } else {
                Text(thread.displayTitle)
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
                    .onTapGesture(count: 2) { beginRename(thread) }
                    .help("Double-click to rename")
                Label(thread.branch, systemImage: "arrow.triangle.branch")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            Spacer(minLength: 8)
            if !renaming {
                PaneBarButton(symbol: "pencil", help: "Rename") { beginRename(thread) }
            }
        }
    }

    private func beginRename(_ thread: ThreadSummary) {
        title = thread.title
        renaming = true
        titleFocused = true
    }

    private func commitRename(_ thread: ThreadSummary) {
        renaming = false
        let trimmed = title.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, trimmed != thread.title else { return }
        Task { await model.threads.rename(id: thread.id, to: trimmed) }
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
