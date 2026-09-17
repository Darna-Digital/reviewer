// An agent session tab: the conversation, the tool activity the agent
// reported between messages, and a composer. The transcript pins to the
// bottom while a turn streams so the reply is watched as it arrives.
import SwiftUI

struct ChatView: View {
    @Bindable var session: ChatSession
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(spacing: 0) {
            header
            transcript
            composer
        }
        .onChange(of: session.isRunning) { wasRunning, running in
            // A finished turn may have edited files and retitled the session:
            // pull the tree, status and the sessions list back in step.
            if wasRunning && !running { Task { await model.refresh() } }
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
            if let chat = session.chat {
                Label(chat.provider.rawValue.capitalized, systemImage: "cpu")
                if !chat.model.isEmpty {
                    Text(chat.model).foregroundStyle(.secondary)
                }
                Label(chat.branch, systemImage: "arrow.triangle.branch")
                    .foregroundStyle(.secondary)
                Text(chat.access.rawValue)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(.quaternary, in: Capsule())
            }
            Spacer()
            if session.isRunning {
                ProgressView().controlSize(.small)
                Button("Stop") { Task { await session.stop() } }
                    .controlSize(.small)
            }
        }
        .font(.caption)
        .padding(.horizontal, 12)
        .frame(height: 30)
        .background(.bar)
        .overlay(alignment: .bottom) { Divider() }
    }

    /// Anchored to the bottom the native way: it opens on the newest item
    /// and stays there as a streaming reply grows, until the reader scrolls
    /// up, at which point the system stops following.
    private var transcript: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 10) {
                if session.chat == nil {
                    ProgressView().frame(maxWidth: .infinity)
                } else if session.timeline.isEmpty {
                    Text("Ask the agent something about this project.")
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, 40)
                }
                ForEach(session.timeline) { item in
                    switch item {
                    case .message(let message): MessageBubble(message: message)
                    case .activity(let activity): ActivityRow(activity: activity)
                    }
                }
                if let turn = session.chat?.latestTurn, turn.state == .error, let reason = turn.errorMessage {
                    Label(reason, systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.red)
                        .font(.callout)
                        .textSelection(.enabled)
                }
            }
            .padding(16)
    }
        .defaultScrollAnchor(.bottom)
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let error = session.error {
                Label(error, systemImage: "exclamationmark.triangle")
                    .font(.caption)
                    .foregroundStyle(.red)
                    .lineLimit(2)
            }
            HStack(alignment: .bottom, spacing: 8) {
                TextField("Message the agent… (⌘↩ to send)", text: $session.draft, axis: .vertical)
                    .textFieldStyle(.plain)
                    .lineLimit(1...8)
                    .padding(8)
                    .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(.quaternary))
                    .onSubmit { Task { await session.send() } }
                Button {
                    Task { await session.send() }
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 22))
                }
                .buttonStyle(.plain)
                .foregroundStyle(canSend ? Color.accentColor : Color.secondary)
                .disabled(!canSend)
                .keyboardShortcut(.return, modifiers: .command)
            }
        }
        .padding(12)
        .background(.bar)
        .overlay(alignment: .top) { Divider() }
    }

    private var canSend: Bool {
        !session.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !session.isRunning && !session.isSending
    }
}

private struct MessageBubble: View {
    let message: ChatMessage

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: message.role == .user ? "person.circle.fill" : "sparkles")
                .font(.system(size: 16))
                .foregroundStyle(message.role == .user ? Color.secondary : Color.accentColor)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 4) {
                Text(message.role == .user ? "You" : "Agent")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if message.text.isEmpty && message.streaming {
                    Text("Thinking…")
                        .foregroundStyle(.tertiary)
                } else {
                    Text(message.text)
                        .textSelection(.enabled)
                        .font(.system(size: 13))
                }
            }
            Spacer(minLength: 0)
        }
        .padding(10)
        .background(
            message.role == .user ? Color(nsColor: .controlBackgroundColor) : Color.clear,
            in: RoundedRectangle(cornerRadius: 8))
    }
}

/// One line per thing the agent did — a tool call, a status note, a failure —
/// with the detail folded away behind a disclosure.
private struct ActivityRow: View {
    let activity: ChatActivity
    @State private var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Image(systemName: symbol)
                    .foregroundStyle(tone)
                    .frame(width: 22)
                if let label = activity.label {
                    Text(label)
                        .font(.system(size: 12, weight: .semibold))
                }
                Text(activity.summary)
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .lineLimit(expanded ? nil : 1)
                    .truncationMode(.middle)
                Spacer(minLength: 0)
                if activity.detail != nil {
                    Image(systemName: expanded ? "chevron.down" : "chevron.right")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
            .contentShape(Rectangle())
            .onTapGesture { if activity.detail != nil { expanded.toggle() } }
            if expanded, let detail = activity.detail {
                Text(detail)
                    .font(.system(size: 11, design: .monospaced))
                    .textSelection(.enabled)
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 6))
                    .padding(.leading, 30)
            }
        }
        .padding(.horizontal, 10)
    }

    private var symbol: String {
        switch activity.tone {
        case .tool: return "wrench.and.screwdriver"
        case .error: return "xmark.octagon"
        case .info: return "info.circle"
        }
    }

    private var tone: Color {
        switch activity.tone {
        case .tool: return .secondary
        case .error: return .red
        case .info: return .blue
        }
    }
}
