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
    @AppStorage(CommitMessages.agentKey) private var agent: CommitAgent = .claude
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
            message = CommitMessages.remembered(for: project)
            filesHeight = savedFilesHeight
            messageHeight = savedMessageHeight
        }
        .onChange(of: project) { _, project in message = CommitMessages.remembered(for: project) }
        .onChange(of: message) { _, message in CommitMessages.remember(message, for: project) }
        .onChange(of: model.landedCommitMessage) { _, landed in
            if let landed, landed.scope == project { message = landed.message }
        }
        .onChange(of: composer.draft, initial: true) { _, draft in takeDraft(draft) }
        .onChange(of: model.commitComposerRequest) { _, request in
            switch request?.action {
            case .draft: draft()
            case .commit: commit(push: false)
            case .commitAndPush: commit(push: true)
            case nil: break
            }
        }
    }

    // A row's path tooltip comes down as the list starts to scroll, since
    // the row it names is moving out from under the pointer; the scroll's
    // start is counted, and the rows put theirs away on it. The rows are
    // made as they scroll in: each is a checkbox and two measured labels,
    // and a large diff has hundreds, which built all at once — and again
    // on every keystroke in the message — was what made the composer lag.
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
            CommitAgentList(agent: agent) { candidate in
                agent = candidate
                agentPickerOpen = false
            }
        }
        .closesOnNavigation($agentPickerOpen)
    }

    private var controls: some View {
        HStack(spacing: 6) {
            Button("Commit") { commit(push: false) }
                .buttonStyle(.glassProminent)
                .disabled(!canCommit)
            Button("Commit and push") { commit(push: true) }
                .buttonStyle(.glass)
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

    /// The buttons are disabled while there is nothing to commit, but ⌘↩
    /// and the chords still reach here, so they are told why nothing
    /// happened, as the TUI tells them.
    private func commit(push: Bool) {
        guard canCommit else {
            model.notices.post(.info, commitBlocker)
            return
        }
        model.act(onTree: .commit(message: message.trimmingCharacters(in: .whitespacesAndNewlines), paths: chosen, push: push))
        message = ""
    }

    private var commitBlocker: String {
        if drafting { return "Wait for the message to be drafted" }
        if chosen.isEmpty { return "Tick at least one file" }
        return "Write a commit message first"
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

/// The agents a draft can be written by, walked from the keys or the
/// pointer as one highlight, opening on the one that is chosen.
private struct CommitAgentList: View {
    let agent: CommitAgent
    let pick: (CommitAgent) -> Void
    @State private var active: Int?

    private var agents: [CommitAgent] { CommitAgent.allCases }

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            ForEach(Array(agents.enumerated()), id: \.element.id) { index, candidate in
                CommitAgentRow(agent: candidate, chosen: candidate == agent, lit: active == index) { inside in
                    if inside { active = index } else if active == index { active = nil }
                } action: {
                    pick(candidate)
                }
            }
        }
        .padding(4)
        .frame(width: 160)
        .popoverListKeys(active: $active, count: agents.count) { pick(agents[$0]) }
        .onAppear { active = agents.firstIndex(of: agent) }
    }
}

private struct CommitAgentRow: View {
    let agent: CommitAgent
    let chosen: Bool
    let lit: Bool
    let hover: (Bool) -> Void
    let action: () -> Void

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
                Color.primary.opacity(lit ? 0.08 : chosen ? 0.06 : 0),
                in: RoundedRectangle(cornerRadius: 6))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover(perform: hover)
    }
}

/// One changed file: its status badge, its name, and the folder it is in
/// — squeezed to the middle when the row is narrow, in which case the
/// pointer on the row says the whole path in the one-line tooltip the
/// branch picker's rows use (see `RowTooltip`).
private struct ChangeRow: View {
    let change: GitStatusEntry
    @Binding var isOn: Bool
    let scrollStarts: Int
    @Environment(\.colorScheme) private var colorScheme
    @State private var folderWidth = 0.0
    @State private var folderFullWidth = 0.0
    @State private var hovering = false

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
        .rowTooltip(folderTruncated ? change.path : nil, active: hovering)
        .onHover { hovering = $0 }
        .onChange(of: scrollStarts) { hovering = false }
    }

    private var folderText: some View {
        Text(folder)
            .font(.system(size: 11))
            .foregroundStyle(.secondary)
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
