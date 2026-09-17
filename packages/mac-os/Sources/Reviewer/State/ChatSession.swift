// One agent session as the UI sees it: the chat as last snapshotted by the
// server, kept current by applying stream events in place. Sending is an HTTP
// call; everything the agent does afterwards arrives over the socket, so the
// session stays correct whether the turn was started here, in the web app,
// or in the Electron shell watching the same server.
import Foundation
import Observation

@MainActor
@Observable
final class ChatSession {
    let id: String
    var chat: Chat?
    var draft = ""
    var error: String?
    var isSending = false

    private let client: ReviewerClient
    private var stream: ChatStream?

    init(id: String, client: ReviewerClient) {
        self.id = id
        self.client = client
    }

    var isRunning: Bool { chat?.isRunning ?? false }
    var title: String { chat?.title ?? "Session" }

    /// Messages with each turn's activity folded in ahead of the reply. Sorting
    /// by time would not do: the assistant's message is appended as an empty
    /// placeholder the moment a turn starts, so by timestamp it precedes every
    /// tool call it is the outcome of. Activities whose turn has no message —
    /// a turn that failed before answering — trail at the end.
    var timeline: [ChatTimelineItem] {
        guard let chat else { return [] }
        var byTurn = Dictionary(grouping: chat.activities, by: \.turnId)
        var items: [ChatTimelineItem] = []
        for message in chat.messages {
            if message.role == .assistant, let activities = byTurn.removeValue(forKey: message.turnId) {
                items += activities.map(ChatTimelineItem.activity)
            }
            items.append(.message(message))
        }
        for activities in byTurn.values.sorted(by: { ($0.first?.createdAt ?? "") < ($1.first?.createdAt ?? "") }) {
            items += activities.map(ChatTimelineItem.activity)
        }
        return items
    }

    func open() {
        let stream = ChatStream(
            onFrame: { [weak self] frame in self?.apply(frame) },
            onClose: { [weak self] error in
                if let error { self?.error = error.localizedDescription }
            })
        stream.connect(to: client.chatStreamURL(chatId: id))
        self.stream = stream
        Task { try? await client.markSeen(chatId: id) }
    }

    func close() {
        stream?.close()
        stream = nil
    }

    func send() async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isSending, !isRunning else { return }
        isSending = true
        defer { isSending = false }
        do {
            chat = try await client.sendMessage(chatId: id, text: text)
            draft = ""
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    func stop() async {
        do {
            try await client.stopChat(id: id)
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func apply(_ frame: ChatWireFrame) {
        switch frame {
        case .snapshot(let snapshot):
            chat = snapshot
        case .ping:
            break
        case .error(let message):
            error = message
        case .event(let event):
            apply(event)
        }
    }

    private func apply(_ event: ChatWireEvent) {
        switch event {
        case .turnStarted(let started):
            chat = started
        case .messageAppended(let message):
            chat?.messages.append(message)
        case .delta(let messageId, let text):
            guard let index = chat?.messages.firstIndex(where: { $0.id == messageId }) else { return }
            chat?.messages[index].text += text
        case .activity(let activity):
            chat?.activities.append(activity)
        case .turnCompleted(let turn, let messageId, let text):
            chat?.latestTurn = turn
            if let index = chat?.messages.firstIndex(where: { $0.id == messageId }) {
                chat?.messages[index].text = text
                chat?.messages[index].streaming = false
            }
        }
    }
}

enum ChatTimelineItem: Identifiable {
    case message(ChatMessage)
    case activity(ChatActivity)

    var id: String {
        switch self {
        case .message(let message): return "m:\(message.id)"
        case .activity(let activity): return "a:\(activity.id)"
        }
    }
}
