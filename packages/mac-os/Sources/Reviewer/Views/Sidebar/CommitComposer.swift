// The commit composer under the changed files, the web sidebar's own in
// commit mode: the changed files with a box each for whether the commit
// takes them, the message — kept per project, so a switch and back finds
// it — an agent to draft one from the chosen files, and Commit, on its own
// or with a push. The file list and the message box each have a drag
// handle along their top edge, as in the web sidebar, and keep the height
// they are left at. The commit and the draft are the page's git actions,
// reached over the bridge; a finished draft arrives in the state the page
// reports, is taken into the message, and is told settled so the server
// lets it go — see `CommitDraft`.
import SwiftUI

struct CommitComposer: View {
    let composer: ShellCommitComposer
    let project: String
    @Environment(AppModel.self) private var model
    @Environment(\.colorScheme) private var colorScheme
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

    private var drafting: Bool { composer.draft?.status == .running }
    private var canCommit: Bool {
        !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !chosen.isEmpty && !drafting
    }

    var body: some View {
        VStack(spacing: 0) {
            ResizeHandle(height: $filesHeight, range: 48...480) { savedFilesHeight = $0 }
            files
            ResizeHandle(height: $messageHeight, range: 48...400) { savedMessageHeight = $0 }
            messageBox
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
                    Toggle(isOn: included(change.path)) {
                        HStack(spacing: 6) {
                            Text(change.status.badge ?? "·")
                                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                .foregroundStyle(change.status.color(dark: colorScheme == .dark))
                                .frame(width: 12)
                            Text(change.path.split(separator: "/").last.map(String.init) ?? change.path)
                                .font(.system(size: 12))
                                .lineLimit(1)
                            Text(FileTree.ancestors(of: change.path).last ?? "")
                                .font(.system(size: 11))
                                .foregroundStyle(.tertiary)
                                .lineLimit(1)
                                .truncationMode(.middle)
                        }
                    }
                    .toggleStyle(.checkbox)
                    .controlSize(.small)
                    .padding(.horizontal, 10)
                    .frame(height: 22)
                    .frame(maxWidth: .infinity, alignment: .leading)
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

/// A hairline along the top edge of an area, dragged to give the area
/// below it more or less room — up for more, the way the web sidebar's
/// handles work. The drag is measured in the window, not in the handle:
/// the handle moves with the edge it drags, and measured against itself
/// every frame would be off by the distance the last one moved it.
private struct ResizeHandle: View {
    @Binding var height: Double
    let range: ClosedRange<Double>
    let onRelease: (Double) -> Void
    @State private var startHeight: Double?

    var body: some View {
        Divider()
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
