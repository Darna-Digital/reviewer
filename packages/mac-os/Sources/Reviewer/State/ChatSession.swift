// One conversation, live: the SPA's `useChatStream` and its reducer, done
// in the shell. The chat's event socket is opened, the `{snapshot}` the
// server replays on connect adopted, and every `{event}` folded through
// the reducer — a delta onto its message, an activity onto the log, a turn
// settling onto both. The socket reconnects with capped backoff (the server
// replays a fresh snapshot each time, so nothing is lost) except after a
// server-reported `{error}`, which is terminal for this id; and a watchdog
// closes a socket that has gone quiet past two heartbeats, since a sleeping
// laptop leaves one open that will never deliver another frame. A REST
// read seeds the view while the first snapshot is on its way.
//
// Having the conversation open is what settles its row's dots in the
// sessions list, so the session is marked seen at each of its resting
// points — opened, and again each time a turn comes to rest — never during
// a stream, and never twice for the same one.
import Foundation
import Observation

enum ChatStreamStatus: Equatable, Sendable {
    case connecting
    case live
    case reconnecting
}

@MainActor
@Observable
final class ChatSession {
    let id: String
    private(set) var chat: Chat?
    private(set) var error: String?
    private(set) var status: ChatStreamStatus = .connecting

    /// Something about the session the sidebar's list shows has changed — a
    /// turn started or ended, the session was looked at — so the list's
    /// rows should be re-read.
    @ObservationIgnored var onListChanged: (() -> Void)?

    @ObservationIgnored private let client: ReviewerClient
    @ObservationIgnored private var socket: URLSessionWebSocketTask?
    @ObservationIgnored private var generation = 0
    @ObservationIgnored private var closed = false
    @ObservationIgnored private var attempts = 0
    @ObservationIgnored private var lastFrameAt = Date()
    @ObservationIgnored private var retry: Task<Void, Never>?
    @ObservationIgnored private var watchdog: Task<Void, Never>?
    @ObservationIgnored private var seenMark: String?

    private static let staleAfter: TimeInterval = 45
    private static let watchdogEvery: Duration = .seconds(5)

    init(id: String, client: ReviewerClient, seed: Chat? = nil) {
        self.id = id
        self.client = client
        self.chat = seed
        connect()
        watch()
        Task { await seedFromRest() }
    }

    var isRunning: Bool { chat?.isRunning ?? false }

    /// The socket put down for good — the page has left this conversation.
    func close() {
        closed = true
        retry?.cancel()
        watchdog?.cancel()
        socket?.cancel(with: .goingAway, reason: nil)
        socket = nil
    }

    // MARK: actions

    /// A send while a turn is running is accepted, not blocked: the server
    /// queues the message and the agent picks it up when the turn settles.
    func send(text: String, images: [ChatImageUpload]) async throws {
        _ = try await client.sendMessage(chatId: id, text: text, images: images)
        onListChanged?()
    }

    func stop() async {
        try? await client.stopChat(id: id)
        onListChanged?()
    }

    /// The composer's settings changed; the server answers with a snapshot
    /// over the socket, so nothing is applied here ahead of it.
    func update(_ patch: UpdateChat) async throws {
        _ = try await client.updateChat(id: id, patch)
        onListChanged?()
    }

    // MARK: the stream

    private func connect() {
        guard !closed else { return }
        generation += 1
        let generation = generation
        let task = URLSession.shared.webSocketTask(with: client.chatStreamURL(chatId: id))
        socket = task
        task.resume()
        Task { await receive(from: task, generation: generation) }
    }

    private func receive(from task: URLSessionWebSocketTask, generation: Int) async {
        do {
            while !closed && generation == self.generation {
                let message = try await task.receive()
                guard !closed && generation == self.generation else { return }
                take(message)
            }
        } catch {
            guard !closed && generation == self.generation else { return }
            dropped()
        }
    }

    private func take(_ message: URLSessionWebSocketTask.Message) {
        lastFrameAt = Date()
        if status != .live {
            status = .live
            attempts = 0
        }
        let data: Data
        switch message {
        case .string(let text): data = Data(text.utf8)
        case .data(let bytes): data = bytes
        @unknown default: return
        }
        guard let frame = try? JSONDecoder().decode(ChatWireFrame.self, from: data) else { return }
        switch frame {
        case .snapshot(let snapshot):
            chat = snapshot
            noteResting()
        case .event(let event):
            chat = Chat.applying(event, to: chat)
            switch event {
            case .turnStarted, .turnCompleted:
                noteResting()
                onListChanged?()
            default:
                break
            }
        case .ping:
            break
        case .error(let message):
            closed = true
            error = message
            socket?.cancel(with: .normalClosure, reason: nil)
        }
    }

    private func dropped() {
        status = .reconnecting
        attempts += 1
        let delay = min(8000, 500 * Int(pow(2, Double(attempts))))
        retry?.cancel()
        retry = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(delay))
            guard !Task.isCancelled else { return }
            self?.connect()
        }
    }

    private func watch() {
        watchdog = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: Self.watchdogEvery)
                guard let self, !closed, let socket else { continue }
                guard Date().timeIntervalSince(lastFrameAt) >= Self.staleAfter else { continue }
                lastFrameAt = Date()
                status = .reconnecting
                socket.cancel(with: .goingAway, reason: nil)
            }
        }
    }

    private func seedFromRest() async {
        guard chat == nil, let fetched = try? await client.chat(id: id), chat == nil, error == nil else { return }
        chat = fetched
        noteResting()
    }

    /// The session marked seen at a resting point it has not been marked at
    /// yet: the mark is a key rather than a flag, so two visits to the same
    /// point send once.
    private func noteResting() {
        guard let chat else { return }
        let mark = "\(chat.id):\(chat.isRunning ? "running" : chat.updatedAt)"
        guard mark != seenMark else { return }
        seenMark = mark
        Task {
            try? await client.markSeen(chatId: id)
            onListChanged?()
        }
    }
}

extension Chat {
    /// The SPA's `applyChatEvent`: one wire event folded onto the snapshot.
    static func applying(_ event: ChatWireEvent, to chat: Chat?) -> Chat? {
        switch event {
        case .turnStarted(let started):
            return started
        case .messageAppended(let message):
            guard var chat else { return nil }
            guard !chat.messages.contains(where: { $0.id == message.id }) else { return chat }
            chat.messages.append(message)
            return chat
        case .delta(let messageId, let text):
            guard var chat, let index = chat.messages.firstIndex(where: { $0.id == messageId }) else { return chat }
            chat.messages[index].text += text
            return chat
        case .activity(let activity):
            guard var chat else { return nil }
            guard !chat.activities.contains(where: { $0.id == activity.id }) else { return chat }
            chat.activities.append(activity)
            return chat
        case .turnCompleted(let turn, let messageId, let text):
            guard var chat else { return nil }
            chat.updatedAt = turn.endedAt ?? chat.updatedAt
            if let index = chat.messages.firstIndex(where: { $0.id == messageId }) {
                chat.messages[index].text = text
                chat.messages[index].streaming = false
            }
            chat.latestTurn = turn
            return chat
        }
    }
}
