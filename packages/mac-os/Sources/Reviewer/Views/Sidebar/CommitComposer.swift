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
    @State private var composerFocused = false
    @State private var agentPickerOpen = false
    @State private var controlsHovered = false
    @AppStorage("commit-files-height") private var savedFilesHeight = 180.0
    @AppStorage("commit-message-height") private var savedMessageHeight = 80.0
    // The heights a drag moves live, written back to the defaults only on
    // release: a defaults write per pointer frame is what made the drag stutter.
    @State private var filesHeight = 180.0
    @State private var filesScrollStarts = 0
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
            .overlay(Self.boxShape.strokeBorder(Color(nsColor: IslandPalette.separator), lineWidth: 1))
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

    // A row's path card is anchored to the row, so it would ride along as
    // the list scrolls; the scroll's start is counted, and the rows close
    // their cards on it. The rows are made as they scroll in: each is a
    // checkbox, two measured labels and a popover, and a large diff has
    // hundreds, which built all at once — and again on every keystroke in
    // the message — was what made the composer lag.
    private var files: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(composer.changes, id: \.path) { change in
                    ChangeRow(change: change, isOn: included(change.path), scrollStarts: filesScrollStarts)
                }
            }
            .padding(.vertical, 4)
        }
        .onScrollPhaseChange { before, after in
            if before == .idle, after != .idle { filesScrollStarts += 1 }
        }
        .frame(height: filesHeight)
    }

    // The draft controls float over the message box's bottom trailing
    // corner, as in the web sidebar, and show only while the message is
    // being written — the box focused, the picker open, a draft running —
    // so the box reads as a plain field until it is in hand. They hover
    // over the text rather than under it: the clearance past their height
    // is the editor's own content inset, as the web textarea's bottom
    // padding is, so the message runs beneath them and its last line
    // scrolls clear of them, instead of the box ending in an empty band
    // the height of the controls.
    private var messageBox: some View {
        CommitMessageEditor(
            text: $message, focused: $composerFocused, bottomClearance: Self.controlsClearance,
            pointerYieldsToControls: controlsHovered
        ) { commit(push: false) }
            .padding(.horizontal, 6)
            .padding(.top, 6)
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
            .overlay(alignment: .bottomTrailing) { draftControls }
    }

    private static let controlsClearance: CGFloat = 40

    private var draftControlsShown: Bool {
        composerFocused || agentPickerOpen || drafting || controlsHovered
    }

    private var draftControls: some View {
        HStack(spacing: 2) {
            GenerateButton(agent: agent, drafting: drafting, action: draft)
                .disabled(chosen.isEmpty || drafting)
            agentPicker
        }
        .padding(2)
        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 8))
        .shadow(color: .black.opacity(0.14), radius: 8, y: 3)
        .padding(6)
        .opacity(draftControlsShown ? 1 : 0)
        .allowsHitTesting(draftControlsShown)
        .animation(.easeOut(duration: 0.15), value: draftControlsShown)
        // Under the pointer, the pair also has the box give up its I-beam
        // for the arrow — see `CommitMessageEditor`.
        .onHover { controlsHovered = $0 }
    }

    private var agentPicker: some View {
        Button { agentPickerOpen.toggle() } label: {
            AgentGlyph(kind: agent.provider, size: 13)
                .frame(width: 14)
        }
        .buttonStyle(ComposerChipStyle())
        .disabled(drafting)
        .help("Draft with \(agent.label)")
        .popover(isPresented: $agentPickerOpen, arrowEdge: .bottom) {
            VStack(alignment: .leading, spacing: 1) {
                ForEach(CommitAgent.allCases) { candidate in
                    CommitAgentRow(agent: candidate, chosen: candidate == agent) {
                        agent = candidate
                        agentPickerOpen = false
                    }
                }
            }
            .padding(4)
            .frame(width: 160)
        }
    }

    private var controls: some View {
        HStack(spacing: 6) {
            Button("Commit") { commit(push: false) }
                .buttonStyle(.borderedProminent)
                .disabled(!canCommit)
            Button("Commit and push") { commit(push: true) }
                .disabled(!canCommit)
            Spacer()
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
            if let error = draft.error { model.notices.post(.error, error) }
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

/// The sparkle that drafts. At rest it is the glyph alone; under the
/// pointer, or while a draft runs, its name fades in beside it — the web
/// sidebar's hover affordance — so the floating pair stays narrow until
/// it is looked at.
private struct GenerateButton: View {
    let agent: CommitAgent
    let drafting: Bool
    let action: () -> Void
    @State private var isHovering = false

    private var expanded: Bool { isHovering || drafting }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 0) {
                if drafting {
                    Orb(size: 13)
                } else {
                    Image(systemName: "sparkles")
                        .font(.system(size: 11, weight: .medium))
                }
                // Only the fade is animated: the width snaps, so the label
                // does not slide as the trailing-aligned button grows.
                Text(drafting ? "Generating…" : "Generate")
                    .fixedSize()
                    .opacity(expanded ? 1 : 0)
                    .animation(.easeOut(duration: 0.15), value: expanded)
                    .frame(width: expanded ? nil : 0, alignment: .leading)
                    .padding(.leading, expanded ? 5 : 0)
                    .clipped()
            }
        }
        .buttonStyle(ComposerChipStyle())
        .onHover { isHovering = $0 }
        .help("Generate a commit message with \(agent.label)")
    }
}

private struct CommitAgentRow: View {
    let agent: CommitAgent
    let chosen: Bool
    let action: () -> Void
    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                AgentGlyph(kind: agent.provider, size: 14)
                Text(agent.label)
                    .font(.system(size: 13, weight: .medium))
                Spacer(minLength: 0)
                if chosen {
                    Image(systemName: "checkmark")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color.accentColor)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                Color.primary.opacity(chosen ? 0.06 : isHovering ? 0.08 : 0),
                in: RoundedRectangle(cornerRadius: 6))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { isHovering = $0 }
    }
}

/// One changed file: its status badge, its name, and the folder it is in
/// — squeezed to the middle when the row is narrow, in which case the
/// pointer resting on the row opens the whole path beside it, the way a
/// session's row opens its preview, and leaving closes it.
private struct ChangeRow: View {
    let change: GitStatusEntry
    @Binding var isOn: Bool
    let scrollStarts: Int
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
        .onChange(of: scrollStarts) { _, _ in
            hoverTask?.cancel()
            pathShown = false
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

/// The card a squeezed row opens under the pointer: the file's icon and
/// its path in full on one line, and what became of the file.
private struct ChangePathCard: View {
    let change: GitStatusEntry
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 6) {
                FileIconView(path: change.path, tint: change.status.hex(dark: colorScheme == .dark))
                Text(change.path)
                    .font(.system(size: 11))
                    .lineLimit(1)
                    .textSelection(.enabled)
            }
            HStack(spacing: 5) {
                Text(change.status.badge ?? "·")
                    .font(.system(size: 10, weight: .semibold, design: .monospaced))
                    .foregroundStyle(change.status.color(dark: colorScheme == .dark))
                Text(change.status.title)
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
            }
            .padding(.leading, 22)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .fixedSize()
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
        ThemedDivider()
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
