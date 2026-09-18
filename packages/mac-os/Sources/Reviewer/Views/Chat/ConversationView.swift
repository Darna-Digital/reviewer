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
        } else {
            VStack(spacing: 8) {
                ProgressView()
                    .controlSize(.small)
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
                    .font(.system(size: 13))
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
                    mode: model.chats.mode(for: chat.id),
                    onModeChange: { model.chats.setMode($0, for: chat.id) },
                    running: chat.isRunning,
                    onStop: { Task { await session.stop() } },
                    placeholder: model.chats.mode(for: chat.id) == .analysis
                        ? "What should the analysis cover?" : "Ask for follow-up changes or attach images…",
                    onSend: { text, images in try await send(text, images, mode: model.chats.mode(for: chat.id)) }
                )
                .zIndex(1)
                SessionContextBar()
            }
            .frame(maxWidth: ChatLayout.columnWidth)
            .padding(.horizontal, 8)
            .padding(.bottom, 16)
        }
    }

    private func send(_ text: String, _ images: [ComposerAttachment], mode: ChatMode) async throws {
        do {
            try await session.send(text: mode.prompt(for: text), images: images.map(\.upload))
        } catch {
            model.lastError = error.localizedDescription
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
                model.lastError = error.localizedDescription
            }
        }
    }
}

enum ChatLayout {
    /// The web page's `max-w-3xl`: the widest a conversation's column runs.
    static let columnWidth: CGFloat = 768
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
                LazyVStack(alignment: .leading, spacing: 20) {
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
                openWindow(id: ReviewerWindow.welcome)
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
                .strokeBorder(Color(nsColor: .separatorColor), lineWidth: 1)
        )
        .padding(.top, -14)
        .padding(.horizontal, 6)
    }
}
