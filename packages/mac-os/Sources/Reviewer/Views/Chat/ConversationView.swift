// One conversation — the web `ChatView`, drawn natively in the page's
// place: the timeline of what was said, the composer under it with the
// strip naming where the session runs, and along the top, while the socket
// is between a drop and the retry that succeeds, the word that the
// connection went rather than the agent. The conversation is the shell's
// own reading of the stream (see `ChatSession`); sends, stops and settings
// go to the server and come back as events.
import SwiftUI

struct ConversationView: View {
    let session: ChatSession
    @Environment(AppModel.self) private var model

    var body: some View {
        if let error = session.error {
            VStack(spacing: 4) {
                Text("Thread unavailable")
                    .font(.system(size: 13, weight: .medium))
                Text(error)
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let chat = session.chat {
            conversation(chat)
                .imageDropZone(draftKey: chat.id)
                .environment(\.openURL, OpenURLAction { url in open(url, in: chat) })
        } else {
            VStack(spacing: 8) {
                Orb(size: 16)
                Text("Loading thread…")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func conversation(_ chat: Chat) -> some View {
        VStack(spacing: 0) {
            if session.status == .reconnecting {
                Label("Connection lost — reconnecting…", systemImage: "bolt.horizontal.circle")
                    .font(.system(size: 11))
                    .foregroundStyle(.orange)
                    .padding(.vertical, 4)
                    .frame(maxWidth: .infinity)
                    .background(Color.orange.opacity(0.1))
                    .overlay(alignment: .bottom) { ThemedDivider() }
            }
            if chat.messages.isEmpty {
                Text("Send a message to start the conversation.")
                    .font(.system(size: ChatLayout.bodySize))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                MessageTimeline(chat: chat)
            }
            VStack(spacing: 0) {
                ChatComposer(
                    draftKey: chat.id,
                    settings: ChatSettings(of: chat),
                    onSettingsChange: { change(settings: $0) },
                    running: chat.isRunning,
                    onStop: { Task { await session.stop() } },
                    placeholder: "Ask for follow-up changes or attach images…",
                    onSend: send
                )
                .zIndex(1)
                SessionContextBar()
            }
            .frame(maxWidth: ChatLayout.columnWidth)
            .padding(.horizontal, 8)
            .padding(.bottom, 16)
        }
    }

    /// A link in a reply: a file it names opens on the browse page, at its
    /// line; a web address goes to the system as a link would; a path the
    /// project does not hold goes nowhere.
    private func open(_ url: URL, in chat: Chat) -> OpenURLAction.Result {
        guard let link = ChatFileLink.parse(url, origin: chat.origin) else {
            return ChatFileLink.leadsOut(url) ? .systemAction : .discarded
        }
        model.browse(file: link.path, line: link.line)
        return .handled
    }

    private func send(_ text: String, _ images: [ComposerAttachment]) async throws {
        do {
            try await session.send(text: text, images: images.map(\.upload))
        } catch {
            model.notices.post(.error, error.localizedDescription)
            throw error
        }
    }

    /// Changing a session's model is a choice about how you work, not only
    /// about this thread, so the next session opens where this one was left.
    private func change(settings: ChatSettings) {
        model.chats.remember(settings)
        Task {
            do {
                try await session.update(
                    UpdateChat(provider: settings.provider, model: settings.model, effort: settings.effort, access: settings.access))
            } catch {
                model.notices.post(.error, error.localizedDescription)
            }
        }
    }
}

enum ChatLayout {
    /// The widest a conversation's column runs. Narrower than the web
    /// page's `max-w-3xl`, which at this size held lines of about 110
    /// characters: a reading measure of roughly 90 is as wide as prose
    /// stays comfortable, since the eye has to find the next line's start
    /// unaided.
    static let columnWidth: CGFloat = 640
    /// The least air either side of the column once the pane is too narrow
    /// to give it its full width.
    static let gutter: CGFloat = 16
    /// The size a conversation reads at — a step over the 13pt of a
    /// control's label, which is set to be glanced at rather than read.
    static let bodySize: CGFloat = 14
    static let bodyMetrics = MarkdownMetrics(size: bodySize)

    /// Where the column starts, measured from the leading edge of the pane.
    ///
    /// Centring the column inside the scroll view would be the obvious way
    /// to place it, and is wrong: a scroller drawn in the pane rather than
    /// over it takes its width out of what the scroll view has to lay out
    /// in, so a conversation long enough to scroll centred its column in a
    /// slightly narrower space and stood half a scroller to the left of the
    /// composer, which is outside the scroll view and never moved. Measured
    /// from the pane instead, the column lands in the same place whether
    /// there is a scroller or not — and in the same place as the composer,
    /// whose own 8pt padding inside a `columnWidth` frame comes out here
    /// too.
    static func columnInset(in paneWidth: CGFloat) -> CGFloat {
        max(gutter, (paneWidth - columnWidth) / 2)
    }
}

/// The conversation: prompts as bubbles at the trailing edge, replies as
/// markdown at the leading edge under each turn's work log. Opens at the
/// bottom and follows the stream while the reader is there; a prompt of
/// their own always brings them back down to it.
///
/// The rows stand in an eager `VStack`, not a lazy one. A reply is one
/// row however long it runs, and a lazy stack only guesses at a row it
/// has not laid out: for a reply many screens tall the guess is off by
/// thousands of points, so the bottom anchor parked the view in empty
/// space past the real end — or the row was never made at all — and a
/// long conversation came back blank. A thread is a few dozen rows at
/// most, so laying them all out costs little.
struct MessageTimeline: View {
    let chat: Chat

    private static let footId = "foot"
    /// How close to the true bottom still counts as parked there. Streamed
    /// text grows the content a point or two between frames, which would
    /// otherwise read as having scrolled away right as the reply arrives.
    private static let followSlack: CGFloat = 24

    /// Whether the reader is at the foot already. A prompt they just sent
    /// always pulls them back down to it, but a reply streaming in only
    /// follows them down while they were already there — scrolling up to
    /// reread something earlier in the turn is never fought.
    @State private var atFoot = true

    var body: some View {
        let running = chat.latestTurn?.state == .running
        let activities = Dictionary(grouping: chat.activities, by: \.turnId)
        let turnError = chat.latestTurn?.state == .error ? chat.latestTurn?.errorMessage : nil
        let lastPrompt = chat.messages.last { $0.role == .user }?.id
        let growth = chat.messages.reduce(0) { $0 + $1.text.count } + chat.activities.count
        GeometryReader { pane in
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 28) {
                        ForEach(chat.messages) { message in
                            if message.role == .user {
                                UserMessageRow(message: message)
                                    .equatable()
                            } else {
                                AssistantMessageRow(
                                    message: message, activities: activities[message.turnId] ?? [],
                                    streaming: message.streaming && running
                                )
                                .equatable()
                            }
                        }
                        if let turnError {
                            TurnErrorView(message: turnError)
                        }
                        Color.clear
                            .frame(height: 1)
                            .id(Self.footId)
                    }
                    .frame(maxWidth: ChatLayout.columnWidth, alignment: .leading)
                    .padding(.leading, ChatLayout.columnInset(in: pane.size.width))
                    .padding(.trailing, ChatLayout.gutter)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 24)
                }
                .defaultScrollAnchor(.bottom)
                .onScrollGeometryChange(for: Bool.self) { geometry in
                    geometry.contentOffset.y + geometry.containerSize.height
                        >= geometry.contentSize.height - Self.followSlack
                } action: { _, atBottom in
                    atFoot = atBottom
                }
                .onChange(of: lastPrompt) { _, _ in
                    proxy.scrollTo(Self.footId, anchor: .bottom)
                }
                .onChange(of: growth) { _, _ in
                    guard atFoot else { return }
                    proxy.scrollTo(Self.footId, anchor: .bottom)
                }
            }
        }
    }
}

/// The strip tucked under the composer, naming where the session will
/// land, read outside in. A session of a workspace is the workspace's —
/// its agent works across every repository of it — so the strip names the
/// workspace and nothing narrower: no one repository, and no branch, which
/// is one repository's. A repository on its own is named with the branch
/// it starts from — the picker the sidebar carries, live here too, since a
/// running session is no reason to lock the window out of its own git.
struct SessionContextBar: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        HStack(spacing: 4) {
            if let workspace = model.workspace, workspace.isMultiRoot {
                EnvironmentCrumb(environment: model.environment)
                WorkspaceBranches(workspace: workspace)
            } else {
                projectButton
                BranchPicker()
                    .controlSize(.small)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 8)
        .padding(.top, 18)
        .padding(.bottom, 5)
        .background(.quaternaryWash(0.35), in: UnevenRoundedRectangle(bottomLeadingRadius: 14, bottomTrailingRadius: 14, style: .continuous))
        .overlay(
            UnevenRoundedRectangle(bottomLeadingRadius: 14, bottomTrailingRadius: 14, style: .continuous)
                .strokeBorder(Color(nsColor: IslandPalette.separator), lineWidth: 1)
        )
        .padding(.top, -14)
        .padding(.horizontal, 6)
    }

    /// Where the session runs, ahead of what it runs across: the machine,
    /// then a chevron leading on to the workspace — the path down from the
    /// environment, as the toolbar's chip and its popover read.
    private struct EnvironmentCrumb: View {
        let environment: ReviewerEnvironment

        var body: some View {
            HStack(spacing: 5) {
                Image(systemName: environment.symbol)
                    .foregroundStyle(.secondary)
                Text(environment.detail ?? environment.name)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Image(systemName: "chevron.right")
                    .font(.system(size: 8, weight: .semibold))
                    .foregroundStyle(.tertiary)
                    .padding(.leading, 1)
            }
            .font(.system(size: 11))
            .padding(.leading, 6)
        }
    }

    /// The workspace a session works across, by its avatars and name, and
    /// the way to any of its repositories' branches, one step at a time:
    /// the repositories first, each with the branch it is on, then — the
    /// popover moving on in place, with the way back at its head — the one
    /// picked's branches, a pick checking that branch out there.
    private struct WorkspaceBranches: View {
        let workspace: WorkspaceInfo
        @Environment(AppModel.self) private var model
        @State private var open = false
        /// The repository whose branches the popover has moved on to.
        @State private var drilled: String?

        var body: some View {
            Button { open.toggle() } label: {
                HStack(spacing: 5) {
                    WorkspaceGlyph(names: workspace.roots.map(\.name), size: 14)
                    Text(workspace.displayName ?? "Workspace")
                        .lineLimit(1)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 8, weight: .semibold))
                        .foregroundStyle(.secondary)
                }
                .font(.system(size: 11))
            }
            .buttonStyle(.accessoryBar)
            .controlSize(.small)
            .help("Branches of \(workspace.roots.map(\.name).joined(separator: ", "))")
            .popover(isPresented: $open, arrowEdge: .bottom) {
                // One list whose rows are the step's — the repositories, or
                // the one picked's branches — so a move between the steps
                // is the popover easing to the new rows' height, the way
                // back fading in above them, and nothing sliding sideways.
                VStack(spacing: 0) {
                    if let root = drilledRoot {
                        back(from: root)
                            .transition(.opacity)
                    }
                    BranchPopover(
                        sections: sections, placeholder: placeholder, pick: pick,
                        dismiss: { open = false }, actions: nil, drillsIn: { $0.branch == nil }
                    ) {
                        EmptyView()
                    }
                }
            }
            .closesOnNavigation($open)
            .onChange(of: open) { if !open { drilled = nil } }
            .task(id: open) {
                guard open else { return }
                await withTaskGroup(of: Void.self) { group in
                    for root in model.roots {
                        group.addTask { await root.loadBranches() }
                    }
                }
            }
        }

        private var drilledRoot: RootModel? { model.root(at: drilled) }

        /// The step's rows: the workspace's repositories, each with the
        /// branch it is on — or the one picked's branches.
        private var sections: [BranchChoiceSection] {
            if let root = drilledRoot { return branchSections(of: root) }
            return [BranchChoiceSection(
                id: "repositories", title: nil,
                rows: model.roots.map { root in
                    BranchChoice(
                        id: root.path, branch: nil, title: root.name, symbol: "folder", tint: nil,
                        badge: nil, checked: false, detail: root.branch ?? "Detached HEAD",
                        detailSymbol: "arrow.triangle.branch", monograms: [root.name])
                })]
        }

        private var placeholder: String {
            drilledRoot.map { "Search \($0.name)’s branches" } ?? "Search repositories"
        }

        /// A repository moves on to its branches; a branch is checked out in
        /// the repository it is listed under.
        private func pick(_ choice: BranchChoice) {
            guard let root = drilledRoot else {
                return step { drilled = choice.id }
            }
            guard let branch = choice.branch, !branch.isCurrent else { return }
            model.checkout(branch.ref, in: root)
        }

        /// The way back to the repositories, over the branches of one.
        private func back(from root: RootModel) -> some View {
            VStack(spacing: 0) {
                Button { step { drilled = nil } } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.secondary)
                        RepoAvatar(name: root.name, size: 16)
                        Text(root.name)
                            .font(.system(size: 12, weight: .semibold))
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 12)
                    .frame(height: 34)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .help("Back to the repositories")
                ThemedDivider()
            }
        }

        /// A move between the steps: the back row fading, the popover easing
        /// to the new rows' height.
        private func step(_ move: () -> Void) {
            withAnimation(.snappy(duration: 0.25), move)
        }

        private func branchSections(of root: RootModel) -> [BranchChoiceSection] {
            let local = root.branches.map { BranchChoice.branch(BranchRef($0), badge: branchDistance($0)) }
            return [
                BranchChoiceSection(id: "recent", title: "Recent", rows: Array(local.prefix(5)), hiddenWhileSearching: true),
                BranchChoiceSection(id: "local", title: "Local", rows: local),
                BranchChoiceSection(id: "remote", title: "Remote", rows: root.remoteBranches.map { .branch(BranchRef($0)) }),
            ]
        }
    }

    private var projectButton: some View {
        Button {
            openWindow(id: ReviewerWindow.opener)
        } label: {
            HStack(spacing: 5) {
                if let name = model.focusedRoot?.name {
                    RepoAvatar(name: name, size: 14)
                    Text(name)
                        .lineLimit(1)
                } else {
                    Image(systemName: "folder")
                    Text("Choose project")
                }
            }
            .font(.system(size: 11))
        }
        .buttonStyle(.accessoryBar)
        .help("Switch project")
    }
}
