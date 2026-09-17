// The preview a session's row opens under the pointer — the web row's hover
// card, as a popover: the untruncated title with when the session last
// moved, the tail of the conversation read as one — what you said in a
// bubble on the right, what the agent said plain across the card, all but
// its last line dimmed — and under a rule, how many messages there are and
// where the session runs. The tail is the conversation itself, fetched from
// the server the moment the card opens; until it arrives, and for a cloud
// run, the card shows the last message the row already knows.
import SwiftUI

struct SessionPreview: View {
    let session: ShellSession
    @Environment(AppModel.self) private var model
    @State private var tail: [ChatMessage] = []

    private static let turns = 3

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 12) {
                Text(session.title)
                    .font(.system(size: 13, weight: .medium))
                    .lineSpacing(2)
                Spacer(minLength: 0)
                if let updated = session.updated {
                    Text(updated, format: .relative(presentation: .named))
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .fixedSize()
                }
            }
            if !tail.isEmpty {
                ConversationTail(messages: tail)
            } else if let last = session.lastMessage, !last.isEmpty {
                Text(last)
                    .font(.system(size: 11))
                    .lineSpacing(2)
                    .lineLimit(3)
                    .foregroundStyle(.secondary)
            }
            Divider()
            HStack(spacing: 6) {
                Image(systemName: "message")
                    .font(.system(size: 11))
                Text(session.messageCount == 1 ? "1 message" : "\(session.messageCount) messages")
                    .monospacedDigit()
                Spacer(minLength: 8)
                Image(systemName: session.kind == .cloud ? "cloud" : "folder")
                    .font(.system(size: 11))
                Text(session.origin)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            .font(.system(size: 11))
            .foregroundStyle(.secondary)
        }
        .padding(12)
        .frame(width: 320, alignment: .leading)
        .task { await load() }
    }

    private func load() async {
        guard session.kind == .session, let chat = try? await model.client.chat(id: session.id) else { return }
        tail = chat.messages
            .filter { !$0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            .suffix(Self.turns)
    }
}

private struct ConversationTail: View {
    let messages: [ChatMessage]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(messages.enumerated()), id: \.element.id) { index, message in
                if message.role == .user {
                    Text(message.text)
                        .font(.system(size: 11))
                        .lineSpacing(2)
                        .lineLimit(2)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(.quaternary.opacity(0.6), in: RoundedRectangle(cornerRadius: 8))
                        .frame(maxWidth: .infinity, alignment: .trailing)
                } else {
                    Text(message.text)
                        .font(.system(size: 11))
                        .lineSpacing(2)
                        .lineLimit(2)
                        .foregroundStyle(index == messages.count - 1 ? .primary : .secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }
}
