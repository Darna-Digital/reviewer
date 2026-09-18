// The commit composer under the changed files, the web sidebar's own in
// commit mode: the changed files with a box each for whether the commit
// takes them, the message — kept per project, so a switch and back finds
// it — an agent to draft one from the chosen files, and Commit, on its own
// or with a push. The file list and the message box each have a drag
// handle along their top edge, as in the web sidebar, and keep the height
// they are left at; together they stand in one rounded box, held off the
// sidebar's edges, with the message's handle as the rule between them. The
// commit and the draft are the page's git actions,
// reached over the bridge; a finished draft arrives in the state the page
// reports, is taken into the message, and is told settled so the server
// lets it go — see `CommitDraft`.
import SwiftUI

struct CommitComposer: View {
    let composer: ShellCommitComposer
    let project: String
    @Environment(AppModel.self) private var model
    @State private var message = ""
    @State private var excluded: Set<String> = []
    @AppStorage("commit-agent") private var agent: CommitAgent = .claude
    @AppStorage("commit-files-height") private var savedFilesHeight = 180.0
    @AppStorage("commit-message-height") private var savedMessageHeight = 80.0
    // The heights a drag moves live, written back to the defaults only on
    // release: a defaults write per pointer frame is what made the drag stutter.
    @State private var filesHeight = 180.0
    @State private var messageHeight = 80.0

    private var chosen: [String] {
        composer.changes.map(\.path).filter { !excluded.contains($0) }
    }

    private static let boxShape = RoundedRectangle(cornerRadius: 6)
    private static let boxInset: CGFloat = 8

    private var drafting: Bool { composer.draft?.status == .running }
    private var canCommit: Bool {
        !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !chosen.isEmpty && !drafting
    }

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 0) {
                ResizeHandle(height: $filesHeight, range: 48...480, rule: false) { savedFilesHeight = $0 }
                files
                ResizeHandle(height: $messageHeight, range: 48...400, rule: true) { savedMessageHeight = $0 }
                messageBox
            }
            .clipShape(Self.boxShape)
            .overlay(Self.boxShape.strokeBorder(Color(nsColor: .separatorColor), lineWidth: 1))
            .padding(.horizontal, Self.boxInset)
            controls
        }
        .onAppear {
            message = Self.remembered(for: project)
            filesHeight = savedFilesHeight
            messageHeight = savedMessageHeight
        }
        .onChange(of: project) { _, project in message = Self.remembered(for: project) }
        .onChange(of: message) { _, message in Self.remember(message, for: project) }
        .onChange(of: composer.draft, initial: true) { _, draft in takeDraft(draft) }
    }

    private var files: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(composer.changes, id: \.path) { change in
                    ChangeRow(change: change, isOn: included(change.path))
                }
            }
            .padding(.vertical, 4)
        }
        .frame(height: filesHeight)
    }

    private var messageBox: some View {
        TextEditor(text: $message)
            .font(.system(size: 12))
            .scrollContentBackground(.hidden)
            .padding(.horizontal, 6)
            .padding(.vertical, 6)
            .frame(height: messageHeight)
            .overlay(alignment: .topLeading) {
                if message.isEmpty {
                    Text(drafting ? "Drafting a message…" : "Commit message")
                        .font(.system(size: 12))
                        .foregroundStyle(.tertiary)
                        .padding(.horizontal, 11)
                        .padding(.vertical, 6)
                        .allowsHitTesting(false)
                }
            }
    }

    private var controls: some View {
        HStack(spacing: 6) {
            Menu {
                ForEach(CommitAgent.allCases) { candidate in
                    Button {
                        agent = candidate
                        draft()
                    } label: {
                        if candidate == agent {
                            Label(candidate.label, systemImage: "checkmark")
                        } else {
                            Text(candidate.label)
                        }
                    }
                }
            } label: {
                if drafting {
                    ProgressView()
                        .controlSize(.mini)
                } else {
                    Image(systemName: "sparkles")
                }
            } primaryAction: {
                draft()
            }
            .menuStyle(.button)
            .fixedSize()
            .disabled(chosen.isEmpty || drafting)
            .help("Draft a message with \(agent.label)")
            Spacer()
            Button("Commit and Push") { commit(push: true) }
                .disabled(!canCommit)
            Button("Commit") { commit(push: false) }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.return, modifiers: .command)
                .disabled(!canCommit)
        }
        .controlSize(.regular)
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
    }

    private func included(_ path: String) -> Binding<Bool> {
        Binding(
            get: { !excluded.contains(path) },
            set: { if $0 { excluded.remove(path) } else { excluded.insert(path) } })
    }

    private func commit(push: Bool) {
        guard canCommit else { return }
        model.act(onTree: .commit(message: message.trimmingCharacters(in: .whitespacesAndNewlines), paths: chosen, push: push))
        message = ""
    }

    private func draft() {
        guard !chosen.isEmpty, !drafting else { return }
        model.act(onTree: .draft(paths: chosen, agent: agent))
    }

    /// A draft that finished — while this composer was up or not — becomes
    /// the message, or the reason it could not; either way it is settled.
    private func takeDraft(_ draft: CommitDraft?) {
        guard let draft else { return }
        switch draft.status {
        case .ready:
            if let text = draft.message { message = text }
            model.act(onTree: .draftSettled)
        case .error:
            if let error = draft.error { model.lastError = error }
            model.act(onTree: .draftSettled)
        case .idle, .running:
            break
        }
    }

    private static func key(for project: String) -> String { "commit-message:\(project)" }

    private static func remembered(for project: String) -> String {
        UserDefaults.standard.string(forKey: key(for: project)) ?? ""
    }

    private static func remember(_ message: String, for project: String) {
        if message.isEmpty {
            UserDefaults.standard.removeObject(forKey: key(for: project))
        } else {
            UserDefaults.standard.set(message, forKey: key(for: project))
        }
    }
}

/// One changed file: its status badge, its name, and the folder it is in
/// — squeezed to the middle when the row is narrow, in which case the
/// pointer resting on the row opens the whole path beside it, the way a
/// session's row opens its preview, and leaving closes it.
private struct ChangeRow: View {
    let change: GitStatusEntry
    @Binding var isOn: Bool
    @Environment(\.colorScheme) private var colorScheme
    @State private var folderWidth = 0.0
    @State private var folderFullWidth = 0.0
    @State private var pathShown = false
    @State private var hoverTask: Task<Void, Never>?

    private static let openDelay: Duration = .milliseconds(120)
    private static let closeDelay: Duration = .milliseconds(100)

    private var folder: String { FileTree.ancestors(of: change.path).last ?? "" }
    private var folderTruncated: Bool { folderWidth + 0.5 < folderFullWidth }

    var body: some View {
        Toggle(isOn: $isOn) {
            HStack(spacing: 6) {
                Text(change.status.badge ?? "·")
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(change.status.color(dark: colorScheme == .dark))
                    .frame(width: 12)
                Text(change.path.split(separator: "/").last.map(String.init) ?? change.path)
                    .font(.system(size: 12))
                    .lineLimit(1)
                folderText
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .onGeometryChange(for: Double.self) { $0.size.width } action: { folderWidth = $0 }
                    .background {
                        folderText
                            .fixedSize()
                            .hidden()
                            .onGeometryChange(for: Double.self) { $0.size.width } action: { folderFullWidth = $0 }
                    }
            }
        }
        .toggleStyle(.checkbox)
        .controlSize(.small)
        .padding(.horizontal, 6)
        .frame(height: 22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .onHover { hovering in
            hoverTask?.cancel()
            guard hovering ? folderTruncated : pathShown else { return }
            hoverTask = Task {
                try? await Task.sleep(for: hovering ? Self.openDelay : Self.closeDelay)
                guard !Task.isCancelled else { return }
                pathShown = hovering
            }
        }
        .popover(isPresented: $pathShown, arrowEdge: .trailing) {
            ChangePathCard(change: change)
        }
    }

    private var folderText: some View {
        Text(folder)
            .font(.system(size: 11))
            .foregroundStyle(.secondary)
    }
}

/// The card a squeezed row opens under the pointer: the path in full,
/// wrapped rather than cut, and what became of the file.
private struct ChangePathCard: View {
    let change: GitStatusEntry
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(change.path)
                .font(.system(size: 12, design: .monospaced))
                .lineSpacing(2)
                .textSelection(.enabled)
            HStack(spacing: 5) {
                Text(change.status.badge ?? "·")
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(change.status.color(dark: colorScheme == .dark))
                Text(change.status.title)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .frame(maxWidth: 360, alignment: .leading)
        .fixedSize(horizontal: false, vertical: true)
    }
}

/// The strip along the top edge of an area, dragged to give the area
/// below it more or less room — up for more, the way the web sidebar's
/// handles work. It draws a hairline, or none where the edge it sits on
/// is drawn already. The drag is measured in the window, not in the handle:
/// the handle moves with the edge it drags, and measured against itself
/// every frame would be off by the distance the last one moved it.
private struct ResizeHandle: View {
    @Binding var height: Double
    let range: ClosedRange<Double>
    let rule: Bool
    let onRelease: (Double) -> Void
    @State private var startHeight: Double?

    var body: some View {
        Divider()
            .opacity(rule ? 1 : 0)
            .frame(height: 7)
            .contentShape(Rectangle())
            .onHover { hovering in
                if hovering { NSCursor.resizeUpDown.push() } else { NSCursor.pop() }
            }
            .gesture(
                DragGesture(minimumDistance: 1, coordinateSpace: .global)
                    .onChanged { drag in
                        let start = startHeight ?? height
                        startHeight = start
                        var transaction = Transaction()
                        transaction.disablesAnimations = true
                        withTransaction(transaction) {
                            height = min(max(start - drag.translation.height, range.lowerBound), range.upperBound)
                        }
                    }
                    .onEnded { _ in
                        startHeight = nil
                        onRelease(height)
                    })
    }
}
