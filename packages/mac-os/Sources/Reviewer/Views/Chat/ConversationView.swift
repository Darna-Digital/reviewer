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
                    .overlay(alignment: .bottom) { Divider() }
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
    /// The size a conversation reads at — a step over the 13pt of a
    /// control's label, which is set to be glanced at rather than read.
    static let bodySize: CGFloat = 14
    static let bodyMetrics = MarkdownMetrics(size: bodySize)
}

/// The conversation: prompts as bubbles at the trailing edge, replies as
/// markdown at the leading edge under each turn's work log. Opens at the
/// bottom and follows the stream while the reader is there; a prompt of
/// their own always brings them back down to it.
struct MessageTimeline: View {
    let chat: Chat

    private static let footId = "foot"

    var body: some View {
        let running = chat.latestTurn?.state == .running
        let activities = Dictionary(grouping: chat.activities, by: \.turnId)
        let turnError = chat.latestTurn?.state == .error ? chat.latestTurn?.errorMessage : nil
        let lastPrompt = chat.messages.last { $0.role == .user }?.id
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 28) {
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
                .frame(maxWidth: ChatLayout.columnWidth)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 16)
                .padding(.vertical, 24)
            }
            .defaultScrollAnchor(.bottom)
            .onChange(of: lastPrompt) { _, _ in
                proxy.scrollTo(Self.footId, anchor: .bottom)
            }
        }
    }
}

/// The strip tucked under the composer, naming where the session will
/// land, read outside in: the project it belongs to, then the branch it
/// starts from — the picker the sidebar carries, live here too, since a
/// running session is no reason to lock the window out of its own git.
struct SessionContextBar: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        HStack(spacing: 4) {
            Button {
                openWindow(id: ReviewerWindow.opener)
            } label: {
                HStack(spacing: 5) {
                    if let name = model.workspace?.projectName {
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
            BranchPicker()
                .controlSize(.small)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 8)
        .padding(.top, 18)
        .padding(.bottom, 5)
        .background(.quaternary.opacity(0.35), in: UnevenRoundedRectangle(bottomLeadingRadius: 14, bottomTrailingRadius: 14, style: .continuous))
        .overlay(
            UnevenRoundedRectangle(bottomLeadingRadius: 14, bottomTrailingRadius: 14, style: .continuous)
                .strokeBorder(Color(nsColor: IslandPalette.separator), lineWidth: 1)
        )
        .padding(.top, -14)
        .padding(.horizontal, 6)
    }
}
