// The assign bar — the web `ReviewAssignBar`, floated over the page island
// natively while the page holds review comments (see `ReviewHandoff`): a
// capsule of Liquid Glass hung near the foot of the page, as Music
// hangs its player over the window, so the diff stays readable through it. On
// it, the count, opening the comments as a list you can jump around the
// review from; the target — a fresh chat with an agent, or a session
// already running, picked from a search over both; the model chip, while
// a fresh chat still has one to choose; Assign; and the fold, which parks
// the bar as a count chip at the page's trailing edge until it is pressed
// or a comment is added. What the bar does crosses back to the page, whose
// comments and hand-off these are.
import SwiftUI

/// The bar over the page: the capsule, centred near the foot, or the chip
/// it folds to at the trailing edge — each sliding in from its own edge,
/// as the web bar does — and nothing to hit anywhere else over the page.
struct ReviewAssignBarLayer: View {
    @Environment(AppModel.self) private var model

    /// Clear of the path bar along the page's foot, so the chip parks
    /// above the trail's buttons rather than over them — the web bar's
    /// own `bottom-[3.25rem]`.
    private static let lift: CGFloat = 52

    var body: some View {
        let handoff = model.reviewHandoff
        ZStack(alignment: .bottom) {
            if let review = handoff.review {
                if handoff.collapsed {
                    CollapsedChip(count: review.comments.count) { handoff.collapsed = false }
                        .frame(maxWidth: .infinity, alignment: .trailing)
                        .transition(.move(edge: .trailing).combined(with: .opacity))
                } else {
                    ReviewAssignBar(review: review)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, Self.lift)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        .animation(ReviewBarMotion.change, value: handoff.isShown)
        .animation(ReviewBarMotion.change, value: handoff.collapsed)
    }
}

enum ReviewBarMotion {
    static var change: Animation? {
        NSWorkspace.shared.accessibilityDisplayShouldReduceMotion ? nil : .spring(duration: 0.32, bounce: 0.18)
    }
}

private struct ReviewAssignBar: View {
    let review: ShellReview
    @Environment(AppModel.self) private var model
    @State private var listOpen = false
    @State private var pickerOpen = false

    private var handoff: ReviewHandoff { model.reviewHandoff }

    var body: some View {
        let target = handoff.target
        HStack(spacing: 4) {
            Button { listOpen.toggle() } label: {
                HStack(spacing: 5) {
                    Text("\(review.comments.count)")
                        .monospacedDigit()
                    Text(review.comments.count == 1 ? "comment" : "comments")
                        .fontWeight(.regular)
                        .foregroundStyle(.secondary)
                    Chevron()
                }
            }
            .buttonStyle(ComposerChipStyle())
            .help("Show the comments")
            .popover(isPresented: $listOpen, arrowEdge: .top) {
                CommentList(review: review) { listOpen = false }
            }
            BarDivider()
            Button { pickerOpen.toggle() } label: {
                HStack(spacing: 6) {
                    AgentGlyph(kind: targetAgent(target), size: ChipSize.large.glyph)
                    Text(targetLabel(target))
                        .lineLimit(1)
                        .truncationMode(.tail)
                    Chevron()
                }
                // Clamped rather than filled: as wide as its title, and no
                // wider than this, where the title truncates instead.
                .frame(maxWidth: 260)
                .fixedSize()
            }
            .buttonStyle(ComposerChipStyle())
            .help("Where the comments go")
            .popover(isPresented: $pickerOpen, arrowEdge: .top) {
                TargetPicker(review: review) { pickerOpen = false }
            }
            if case .new(let agent, let modelId) = target {
                ModelPicker(catalog: model.chats.catalog, model: modelId, provider: agent) { chosen in
                    handoff.pick(.new(agent: chosen.provider, model: chosen.id))
                }
            }
            Button(review.assigning ? "Assigning…" : "Assign") {
                model.act(onReview: .assign(target))
            }
            .buttonStyle(AssignButtonStyle())
            .disabled(review.assigning)
            .keyboardShortcut(.defaultAction)
            Button { handoff.collapsed = true } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.secondary)
                    .frame(width: 26)
            }
            .buttonStyle(ComposerChipStyle())
            .help("Hide")
        }
        .padding(8)
        .environment(\.chipShape, .capsule)
        .environment(\.chipSize, .large)
        .glassEffect(.regular, in: .capsule)
        .shadow(color: .black.opacity(0.18), radius: 18, y: 8)
    }

    private func targetAgent(_ target: ReviewTarget) -> ChatProviderKind {
        switch target {
        case .new(let agent, _): return agent
        case .existing: return handoff.targetSession?.provider ?? .claude
        }
    }

    private func targetLabel(_ target: ReviewTarget) -> String {
        switch target {
        case .new(let agent, _): return "New \(agent.label) chat"
        case .existing: return handoff.targetSession?.title ?? "Session"
        }
    }
}

/// The bar folded: the count alone, on the same glass, where the bar comes
/// back from.
private struct CollapsedChip: View {
    let count: Int
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: "bubble.left")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.secondary)
                Text("\(count)")
                    .monospacedDigit()
            }
            .font(.system(size: 13, weight: .medium))
            .padding(.horizontal, 14)
            .frame(height: 36)
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .glassEffect(.regular.interactive(), in: .capsule)
        .shadow(color: .black.opacity(0.14), radius: 12, y: 5)
        .help("Show \(count) review \(count == 1 ? "comment" : "comments")")
    }
}

/// The comments as a review reads them: each file's name once, its notes
/// under it — the line in a gutter, then what it says. A note on the code
/// is a way to it; one on the running UI sits on no line and only reads
/// back. The delete stays dark until the row is under the pointer.
private struct CommentList: View {
    let review: ShellReview
    let dismiss: () -> Void
    @Environment(AppModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                ForEach(review.byFile, id: \.file) { group in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(group.comments.first?.fileName ?? group.file)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .padding(.horizontal, 10)
                            .padding(.bottom, 4)
                        ForEach(group.comments) { comment in
                            CommentRow(
                                comment: comment,
                                onOpen: {
                                    dismiss()
                                    model.act(onReview: .open(comment.id))
                                },
                                onDelete: { model.act(onReview: .delete(comment.id)) })
                        }
                    }
                }
            }
            .padding(8)
        }
        .frame(width: 360)
        .frame(maxHeight: 320)
    }
}

private struct CommentRow: View {
    let comment: ShellReviewComment
    let onOpen: () -> Void
    let onDelete: () -> Void
    @State private var isHovering = false

    var body: some View {
        HStack(alignment: .top, spacing: 4) {
            Button(action: onOpen) { content }
                .buttonStyle(.plain)
            Button(action: onDelete) {
                Image(systemName: "xmark")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .frame(width: 20, height: 20)
            }
            .buttonStyle(.plain)
            .opacity(isHovering ? 1 : 0)
            .padding(.top, 6)
            .padding(.trailing, 6)
            .help("Delete comment")
        }
        .background(Color.primary.opacity(isHovering ? 0.08 : 0), in: RoundedRectangle(cornerRadius: 6))
        .onHover { isHovering = $0 }
    }

    private var content: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text("\(comment.line)")
                .monospacedDigit()
                .foregroundStyle(.secondary)
                .frame(minWidth: 28, alignment: .trailing)
            Text(comment.body)
                .lineLimit(3)
                .lineSpacing(2)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .font(.system(size: 13))
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .contentShape(Rectangle())
    }
}

/// Where the review goes, under one search: a fresh chat with any of the
/// agents, then the sessions already working on the comments' branch — led
/// by, under a heading that names it — and the rest of the project's,
/// so a comment can still be handed to a session that is elsewhere.
private struct TargetPicker: View {
    let review: ShellReview
    let dismiss: () -> Void
    @Environment(AppModel.self) private var model
    @State private var query = ""
    @FocusState private var fieldFocused: Bool

    private var handoff: ReviewHandoff { model.reviewHandoff }

    var body: some View {
        let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
        let agents = ChatProviderKind.allCases.filter { needle.isEmpty || $0.label.lowercased().contains(needle) }
        let matches = { (chat: ChatSummary) in
            needle.isEmpty || chat.title.lowercased().contains(needle) || chat.branch.lowercased().contains(needle)
        }
        let here = handoff.sessions(onBranch: review.branch).filter(matches)
        let hereIds = Set(here.map(\.id))
        let elsewhere = handoff.sessions.filter { !hereIds.contains($0.id) && matches($0) }
        VStack(spacing: 0) {
            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.secondary)
                TextField("Search sessions…", text: $query)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12))
                    .focused($fieldFocused)
            }
            .padding(.horizontal, 10)
            .frame(height: 32)
            ThemedDivider()
            if agents.isEmpty && here.isEmpty && elsewhere.isEmpty {
                Text("No matches")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 1) {
                        if !agents.isEmpty {
                            Heading("New chat")
                            ForEach(agents, id: \.self) { agent in
                                PickerRow(chosen: isNew(agent)) { handoff.pick(agent: agent); dismiss() } label: {
                                    AgentGlyph(kind: agent, size: 14)
                                    Text(agent.label)
                                        .lineLimit(1)
                                }
                            }
                        }
                        if !here.isEmpty {
                            Heading("On ‘\(review.branch)’")
                            ForEach(here) { chat in sessionRow(chat, showBranch: false) }
                        }
                        if !elsewhere.isEmpty {
                            Heading(here.isEmpty ? "Sessions" : "Other sessions")
                            ForEach(elsewhere) { chat in sessionRow(chat, showBranch: true) }
                        }
                    }
                    .padding(4)
                }
                .frame(maxHeight: 280)
            }
        }
        .frame(width: 320)
        .onAppear {
            Task { @MainActor in fieldFocused = true }
            Task { await handoff.reloadSessions() }
        }
    }

    private func isNew(_ agent: ChatProviderKind) -> Bool {
        if case .new(let chosen, _) = handoff.target { return chosen == agent }
        return false
    }

    private func sessionRow(_ chat: ChatSummary, showBranch: Bool) -> some View {
        PickerRow(chosen: handoff.target == .existing(chatId: chat.id)) {
            handoff.pick(.existing(chatId: chat.id))
            dismiss()
        } label: {
            AgentGlyph(kind: chat.provider, size: 14)
            Text(chat.title)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
            if showBranch {
                Text(chat.branch)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .frame(maxWidth: 120, alignment: .trailing)
            }
        }
        .help(sessionHint(chat))
    }

    /// What the row cannot show: the last thing said, and when.
    private func sessionHint(_ chat: ChatSummary) -> String {
        let tail = chat.lastMessage?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let when = "\(TimeAgo.text(chat.updatedAt)) · \(chat.messageCount) \(chat.messageCount == 1 ? "message" : "messages")"
        return tail.isEmpty ? when : "\(tail)\n\n\(when)"
    }
}

private struct Heading: View {
    let text: String

    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(.secondary)
            .lineLimit(1)
            .padding(.horizontal, 8)
            .padding(.top, 6)
            .padding(.bottom, 2)
    }
}

private struct PickerRow<Label: View>: View {
    let chosen: Bool
    let action: () -> Void
    @ViewBuilder let label: Label
    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                label
            }
            .font(.system(size: 13))
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

/// The bar's one filled control: a capsule of glass tinted the theme's
/// accent — the colour every lit control in the app shares, and on the
/// app's own palette the system's accent, which is what a prominent
/// button would have worn anyway — cut to the chips' height, so the
/// capsule reads as one row with a single thing to press.
private struct AssignButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 16)
            .frame(height: 32)
            .glassEffect(.regular.tint(Color(nsColor: IslandPalette.accent).opacity(isEnabled ? 1 : 0.5)).interactive(), in: .capsule)
            .opacity(configuration.isPressed ? 0.85 : 1)
            .contentShape(Capsule())
    }
}

private struct Chevron: View {
    var body: some View {
        Image(systemName: "chevron.down")
            .font(.system(size: ChipSize.large.chevron, weight: .semibold))
            .foregroundStyle(.secondary)
    }
}

private struct BarDivider: View {
    var body: some View {
        Rectangle()
            .fill(Color(nsColor: IslandPalette.separator))
            .frame(width: 1, height: 18)
            .padding(.horizontal, 4)
    }
}
