// The sessions surface in the page island's place, following the island's
// address (see `Chats`): a fresh session composed from the middle of the
// pane, one conversation, or the landing the page passes through on its
// way to the newest session. The island underneath stays where it is —
// the tab strip and the sessions list are still its — but shows nothing of
// its own on these pages inside the shell; what stands here is opaque, on
// the island's own material, so the two read as one panel.
import AppKit
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
        .background(PageAnchor())
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
                Text("Start one with + in the rail, or widen the filters beside it.")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            } else {
                ProgressView()
                    .controlSize(.small)
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
    private var mode: ChatMode { chats.mode(for: Chats.newSessionKey) }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                VStack(spacing: 6) {
                    Text(mode == .analysis ? "What should we analyse?" : "What should we work on?")
                        .font(.system(size: 24, weight: .medium))
                        .tracking(-0.3)
                    if mode == .analysis {
                        Text("An agent reads the code and draws the flow, front to back, into the analysis pane.")
                            .font(.system(size: 13))
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: 420)
                    }
                }
                .padding(.bottom, 16)
                VStack(spacing: 0) {
                    ChatComposer(
                        draftKey: Chats.newSessionKey,
                        settings: chats.newSessionSettings,
                        onSettingsChange: { chats.remember($0) },
                        mode: mode,
                        onModeChange: { chats.setMode($0, for: Chats.newSessionKey) },
                        running: false,
                        placeholder: mode == .analysis ? "How is a new branch created?" : "Ask anything, or describe a change…",
                        onSend: start
                    )
                    .zIndex(1)
                    SessionContextBar()
                }
                suggestions
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

    /// Openers for the two things this app can do that a chat box does not
    /// advertise: neither sends — one flips the mode, the other types the
    /// opening of the prompt and leaves the subject to be filled in.
    private var suggestions: some View {
        VStack(spacing: 1) {
            SuggestionRow(symbol: "point.3.connected.trianglepath.dotted", label: "Create analysis of a feature") {
                chats.setMode(.analysis, for: Chats.newSessionKey)
            }
            SuggestionRow(symbol: "globe", label: "Preview changes in browser") {
                var draft = chats.draft(for: Chats.newSessionKey)
                draft.text = "Preview my changes in the browser and check "
                chats.setDraft(draft, for: Chats.newSessionKey)
            }
        }
    }

    private func start(_ text: String, _ images: [ComposerAttachment]) async throws {
        do {
            let chat = try await chats.start(
                settings: chats.newSessionSettings, mode: mode, text: text, images: images,
                branch: model.currentBranch)
            model.show(chat: chat)
        } catch {
            model.lastError = error.localizedDescription
            throw error
        }
    }
}

private struct SuggestionRow: View {
    let symbol: String
    let label: String
    let action: () -> Void
    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: symbol)
                    .font(.system(size: 13))
                    .frame(width: 18)
                Text(label)
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .font(.system(size: 13))
            .foregroundStyle(isHovering ? Color.primary : Color.secondary)
            .padding(.horizontal, 8)
            .frame(height: 36)
            .background(Color.primary.opacity(isHovering ? 0.06 : 0), in: RoundedRectangle(cornerRadius: 8))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { isHovering = $0 }
    }
}

/// Where the native page stands in the window, registered for the
/// launchpad to photograph it in the web view's place.
private struct PageAnchor: NSViewRepresentable {
    @Environment(AppModel.self) private var model

    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        model.chats.pageView = view
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        model.chats.pageView = nsView
    }
}

extension NSView {
    /// This view's region of the window, drawn to an image — the SwiftUI
    /// content over it included, since the window's content view is what
    /// is asked to draw the region.
    func snapshotRegion() -> NSImage? {
        guard let content = window?.contentView else { return nil }
        let rect = convert(bounds, to: content)
        guard !rect.isEmpty, let rep = content.bitmapImageRepForCachingDisplay(in: rect) else { return nil }
        content.cacheDisplay(in: rect, to: rep)
        let image = NSImage(size: rect.size)
        image.addRepresentation(rep)
        return image
    }
}
