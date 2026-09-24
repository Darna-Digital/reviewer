// The Terminal surface, laid out as the system's own Terminal is: the
// project's shells as a row of tabs along the top — every tab an equal
// share of the width, its title centred, the one in front filled, its ✕ at
// the leading edge as the system puts it — and the mark that opens one at
// the trailing end. Nothing else: a shell is opened, picked and closed,
// and that is the whole of it. The Run surface beside it keeps the table
// and its toolbar, since a command is a thing to add, edit and remove; a
// shell is not. A double-click on a tab, or its menu, renames it in place
// the way Finder renames a file. A repository with no shell of its own
// opens one on the way in, so the surface comes up on a prompt rather than
// on a placeholder; the placeholder is left for the shell that could not
// be opened, and for the last one closed by hand. Every shell visited
// stays attached while hidden, so coming back is the screen as you left
// it.
import Observation
import SwiftTerm
import SwiftUI

/// SwiftTerm brings a `Color` of its own, which this file has no use for.
private typealias Color = SwiftUI.Color

struct TerminalPane: View {
    @Environment(AppModel.self) private var model
    @State private var rename = ThreadRename()

    private var threads: Threads { model.threads }

    private var shells: [ThreadSummary] {
        threads.threads.filter { $0.agent == "terminal" }
    }

    var body: some View {
        VStack(spacing: 0) {
            ShellTabBar(shells: shells, open: open, close: close(id:))
            terminal
        }
        .environment(rename)
        .task(id: model.workspace?.project) { await openFirstSession() }
    }

    /// The shells of the project being opened, and one opened for it if it
    /// has none. A load that failed opens nothing: the server is the one
    /// keeping the shells, and asking it for another while it is out of
    /// reach would leave a repository with a shell more every time the
    /// surface is looked at.
    private func openFirstSession() async {
        await threads.load()
        guard threads.lastError == nil, shells.isEmpty else { return }
        await threads.open(branch: model.currentBranch)
        // A load the project's own refresh already had in flight answers
        // with the list as it was — the list without the shell just opened
        // — and puts the surface back on the placeholder. Asking again
        // picks it up.
        if threads.lastError == nil, shells.isEmpty { await threads.load() }
    }

    @ViewBuilder
    private var terminal: some View {
        if let thread = threads.selected {
            let stream = threads.stream(for: thread.id)
            TerminalWell {
                TerminalHost(view: stream.view)
                    .id(ObjectIdentifier(stream))
            }
        } else {
            PanePlaceholder("No session open", symbol: "terminal",
                            detail: threads.lastError ?? "Open a shell in this project.") {
                Button("New session", action: open)
            }
        }
    }

    private func open() {
        Task { await threads.open(branch: model.currentBranch) }
    }

    /// Closing the tab in front leaves the neighbour in front, as the
    /// system's tabs do, rather than jumping back to the first.
    private func close(id: String) {
        if threads.selectedId == id { threads.selectedId = neighbour(of: id)?.id }
        Task { await threads.close(id: id) }
    }

    private func neighbour(of id: String) -> ThreadSummary? {
        guard let index = shells.firstIndex(where: { $0.id == id }) else { return nil }
        let after = shells.index(after: index)
        return after < shells.endIndex ? shells[after] : (index > 0 ? shells[index - 1] : nil)
    }
}

/// Which session is being renamed, and the title typed so far.
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

/// The row of shells: the tabs sharing the width between them, then the
/// mark that opens one, on a bar of the surface's own height.
private struct ShellTabBar: View {
    let shells: [ThreadSummary]
    let open: () -> Void
    let close: (String) -> Void
    @Environment(AppModel.self) private var model

    var body: some View {
        HStack(spacing: 3) {
            ForEach(shells) { thread in
                ShellTab(thread: thread,
                         isSelected: model.threads.selectedId == thread.id,
                         select: { model.threads.selectedId = thread.id },
                         close: { close(thread.id) })
            }
            // The tabs take the width between them, so the mark ends up at
            // the trailing edge on its own; with no tabs to push it there,
            // this keeps it on that edge rather than in the middle.
            Spacer(minLength: 0)
            NewShellButton(action: open)
        }
        .padding(.horizontal, 5)
        .frame(height: PaneMetrics.barHeight)
        .frame(maxWidth: .infinity)
        .overlay(alignment: .bottom) { ThemedDivider() }
    }
}

enum ShellTabMetrics {
    static let height: CGFloat = 22
    /// The ✕ stands in this much room at the leading edge, and the same is
    /// left free at the trailing one, so the title reads centred in the tab.
    static let closeSlot: CGFloat = 20
}

/// One shell's tab: its title, centred, and a ✕ at the leading edge —
/// always on the tab in front, under the pointer on the rest, as the
/// system's tabs show it. The ✕ is laid over the tab rather than set in
/// its label, since a button inside a button's label never gets the click.
private struct ShellTab: View {
    let thread: ThreadSummary
    let isSelected: Bool
    let select: () -> Void
    let close: () -> Void
    @Environment(AppModel.self) private var model
    @Environment(ThreadRename.self) private var rename
    @State private var isHovering = false

    var body: some View {
        Button(action: select) {
            title
                .frame(maxWidth: .infinity)
                .padding(.horizontal, ShellTabMetrics.closeSlot)
                .frame(height: ShellTabMetrics.height)
                .background(fill, in: Capsule())
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .simultaneousGesture(TapGesture(count: 2).onEnded { rename.begin(thread) })
        .overlay(alignment: .leading) {
            if isSelected || isHovering {
                ShellTabClose(title: thread.displayTitle, action: close)
                    .frame(width: ShellTabMetrics.closeSlot, height: ShellTabMetrics.height)
            }
        }
        .onHover { isHovering = $0 }
        .help(thread.displayTitle)
        .contextMenu {
            Button("Rename") { rename.begin(thread) }
            Divider()
            Button("Close session", role: .destructive, action: close)
        }
    }

    @ViewBuilder
    private var title: some View {
        if rename.id == thread.id {
            @Bindable var rename = rename
            RenameField(text: $rename.draft) {
                commitRename()
            } cancel: {
                rename.cancel()
            }
        } else {
            Text(thread.displayTitle)
                .font(.system(size: 11, weight: isSelected ? .medium : .regular))
                .foregroundStyle(isSelected || isHovering ? .primary : .secondary)
                .lineLimit(1)
                .truncationMode(.tail)
        }
    }

    private var fill: Color {
        if isSelected { return .primary.opacity(BarChipMetrics.onTint) }
        if isHovering { return .primary.opacity(BarChipMetrics.hoverTint) }
        return .clear
    }

    private func commitRename() {
        guard let title = rename.finish(thread) else { return }
        Task { await model.threads.rename(id: thread.id, to: title) }
    }
}

/// The ✕ in a tab's leading slot: lit only under the pointer, so it reads
/// as part of the tab until it is reached for.
private struct ShellTabClose: View {
    let title: String
    let action: () -> Void
    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            Image(systemName: "xmark")
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(isHovering ? .primary : .secondary)
                .frame(width: 15, height: 15)
                .background(isHovering ? Color.primary.opacity(BarChipMetrics.onTint) : .clear, in: Circle())
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { isHovering = $0 }
        .help("Close \(title)")
        .accessibilityLabel("Close \(title)")
    }
}

/// The mark at the row's trailing end, in the round the system gives it.
private struct NewShellButton: View {
    let action: () -> Void
    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            Image(systemName: "plus")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(isHovering ? .primary : .secondary)
                .frame(width: ShellTabMetrics.height, height: ShellTabMetrics.height)
                .background(isHovering ? Color.primary.opacity(BarChipMetrics.hoverTint) : .clear, in: Circle())
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .onHover { isHovering = $0 }
        .help("New session")
        .accessibilityLabel("New session")
    }
}

/// The field a tab's name turns into while it is being renamed: focused as
/// soon as it appears, Return keeps the new name, Escape drops it, and
/// clicking away keeps it too, as Finder does.
private struct RenameField: View {
    @Binding var text: String
    let commit: () -> Void
    let cancel: () -> Void
    @FocusState private var focused: Bool

    var body: some View {
        TextField("Title", text: $text)
            .textFieldStyle(.plain)
            .font(.system(size: 11))
            .multilineTextAlignment(.center)
            .focused($focused)
            .onSubmit(commit)
            .onExitCommand(perform: cancel)
            .onChange(of: focused) { _, isFocused in
                if !isFocused { commit() }
            }
            .task { focused = true }
    }
}

private extension ThreadSummary {
    var displayTitle: String { title.isEmpty ? "Terminal" : title }
}

/// The terminal in a SwiftUI hierarchy, standing in a `HeldView` so a move
/// of the sidebar does not resize it frame by frame.
struct TerminalHost: NSViewRepresentable {
    let view: TerminalView

    func makeNSView(context: Context) -> HeldView { HeldView(holding: view) }
    func updateNSView(_ nsView: HeldView, context: Context) {
        nsView.follow(context.environment.sidebarHold)
    }
}
