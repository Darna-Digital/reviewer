// The rows a conversation is made of, in the web timeline's shape: a
// prompt as a bubble at the trailing edge with its images over it, a reply
// as bare markdown at the leading edge under the turn's work log — the
// tool calls and thinking folded to one collapsed line — and, while the
// reply is still coming, the indicator naming the work in flight. Every
// row is equatable on the message it draws, so a token landing in the
// reply at the bottom leaves the rows above it alone.
import SwiftUI

struct UserMessageRow: View, Equatable {
    let message: ChatMessage

    var body: some View {
        HStack {
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 8) {
                if let attachments = message.attachments, !attachments.isEmpty {
                    AttachmentGrid(alignment: .trailing) {
                        ForEach(Array(attachments.enumerated()), id: \.offset) { _, attachment in
                            SentAttachmentPreview(attachment: attachment)
                        }
                    }
                }
                if !message.text.isEmpty {
                    Text(message.text)
                        .font(.system(size: ChatLayout.bodySize))
                        .lineSpacing(ChatLayout.bodyMetrics.leading)
                        .textSelection(.enabled)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 9)
                        .background(.quaternaryWash(0.6), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
            }
            .frame(maxWidth: 560, alignment: .trailing)
        }
    }
}

struct AssistantMessageRow: View, Equatable {
    let message: ChatMessage
    let activities: [ChatActivity]
    /// Whether the reply is still coming — the message's own flag, and the
    /// turn still running: a settled message never streams whatever the
    /// turn does.
    let streaming: Bool

    var body: some View {
        let steps = WorkLog.steps(of: activities, turnRunning: streaming)
        let active = streaming ? WorkLog.activeStep(steps) : nil
        VStack(alignment: .leading, spacing: 10) {
            if !steps.isEmpty {
                WorkLogView(steps: steps)
            }
            if !message.text.isEmpty {
                MarkdownText(text: message.text, size: ChatLayout.bodySize)
            } else if !streaming && message.streaming {
                Label("Stopped before replying.", systemImage: "stop.fill")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            if streaming {
                ThinkingIndicator(label: active?.summary)
                    .padding(.vertical, 2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// A failed turn's error: the lead paragraph inline, and the rest — long
/// remediation like the logged-out hint — behind a disclosure.
struct TurnErrorView: View {
    let message: String
    @State private var detailsShown = false

    var body: some View {
        let parts = message.components(separatedBy: "\n\n").filter { !$0.isEmpty }
        let summary = parts.first ?? message
        let details = parts.dropFirst().joined(separator: "\n\n")
        HStack(alignment: .top, spacing: 6) {
            Image(systemName: "exclamationmark.circle")
                .font(.system(size: 11, weight: .medium))
                .padding(.top, 2)
            VStack(alignment: .leading, spacing: 4) {
                Text(summary)
                    .textSelection(.enabled)
                if !details.isEmpty {
                    Button {
                        withAnimation(.easeOut(duration: 0.15)) { detailsShown.toggle() }
                    } label: {
                        Label("Details", systemImage: detailsShown ? "chevron.down" : "chevron.right")
                            .font(.system(size: 11))
                    }
                    .buttonStyle(.plain)
                    if detailsShown {
                        Text(details)
                            .textSelection(.enabled)
                            .opacity(0.9)
                    }
                }
            }
        }
        .font(.system(size: 11))
        .foregroundStyle(.red)
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.red.opacity(0.06), in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(Color.red.opacity(0.3), lineWidth: 1))
    }
}

/// An agent at work: the orb beside a label. Given one, it names the work in
/// flight; given none it cycles generic words, the honest rendering for the
/// stretch where the model is generating and there is nothing else to report.
struct ThinkingIndicator: View {
    var label: String?
    @State private var word = 0

    private static let idleWords = ["Thinking", "Working", "Reasoning", "Composing"]

    var body: some View {
        HStack(spacing: 7) {
            Orb(size: 16)
            Text(label ?? Self.idleWords[word])
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .truncationMode(.tail)
                .contentTransition(.opacity)
                .id(label == nil ? word : -1)
        }
        .task(id: label == nil) {
            guard label == nil else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(4))
                guard !Task.isCancelled else { return }
                withAnimation(.easeOut(duration: 0.2)) { word = (word + 1) % Self.idleWords.count }
            }
        }
        .accessibilityLabel("Working…")
    }
}
