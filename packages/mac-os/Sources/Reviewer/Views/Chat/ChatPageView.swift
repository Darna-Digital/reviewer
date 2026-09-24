// The sessions surface in the page island's place, following the island's
// address (see `Chats`): a fresh session composed from the middle of the
// pane, one conversation, or the landing the page passes through on its
// way to the newest session. The island underneath stays where it is —
// the tab strip and the sessions list are still its — but shows nothing of
// its own on these pages inside the shell; what stands here is opaque, on
// the island's own material, so the two read as one panel.
import SwiftUI

struct ChatPageView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Group {
            switch model.chats.page {
            case .newSession:
                NewChatView()
            case .conversation:
                if let session = model.chats.session {
                    ConversationView(session: session)
                        .id(session.id)
                }
            case .landing:
                SessionsLanding()
            case nil:
                EmptyView()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(nsColor: IslandPalette.island))
    }
}

/// What is behind the wait for the list to open its newest session: the
/// wait, and the case where there is nothing to open.
private struct SessionsLanding: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let list = model.sessions
        VStack(spacing: 4) {
            if let list, !list.loading, list.sessions.isEmpty {
                Text("No sessions here")
                    .font(.system(size: 13, weight: .medium))
                Text("Start one with ⌘T, or widen the filters above the list.")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            } else {
                Orb(size: 16, label: "Loading")
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// A fresh session, composed from the middle of the pane rather than the
/// bottom edge: nothing has been said yet, so there is no transcript for
/// the composer to sit under, and centring it is what says the page is
/// waiting on you. The settings are the last session's, put through what
/// the chosen agent can run; the first send creates the chat, starts the
/// turn, and sends the island to the conversation.
private struct NewChatView: View {
    @Environment(AppModel.self) private var model

    /// The pane's height, so the composer stands in the middle of it while
    /// there is room, and scrolls when there is not.
    @State private var viewport: CGFloat = 0

    private var chats: Chats { model.chats }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                Text("What should we work on?")
                    .font(.system(size: 24, weight: .medium))
                    .tracking(-0.3)
                    .padding(.bottom, 16)
                VStack(spacing: 0) {
                    ChatComposer(
                        draftKey: Chats.newSessionKey,
                        settings: chats.newSessionSettings,
                        onSettingsChange: { chats.remember($0) },
                        running: false,
                        placeholder: "Ask anything, or describe a change…",
                        onSend: start
                    )
                    .zIndex(1)
                    SessionContextBar()
                }
            }
            .frame(maxWidth: ChatLayout.columnWidth)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 24)
            .padding(.vertical, 32)
            .frame(minHeight: viewport)
        }
        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { viewport = $0 }
        .imageDropZone(draftKey: Chats.newSessionKey)
    }

    private func start(_ text: String, _ images: [ComposerAttachment]) async throws {
        do {
            let chat = try await chats.start(
                settings: chats.newSessionSettings, text: text, images: images,
                branch: model.currentBranch)
            model.show(chat: chat)
        } catch {
            model.notices.post(.error, error.localizedDescription)
            throw error
        }
    }
}

