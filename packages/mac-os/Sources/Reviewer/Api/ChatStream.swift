// The push side of a chat: one WebSocket per open session, fed by the server's
// chat turn runtime (`/api/chats/stream?chat=<id>`). The socket is read-only —
// turns are started over HTTP — so this only decodes frames and hands them to
// the session on the main actor. Pings from the server are answered by
// URLSession itself, which is what keeps the server's liveness check happy.
import Foundation

@MainActor
final class ChatStream {
    private var task: URLSessionWebSocketTask?
    private var reader: Task<Void, Never>?
    private let onFrame: (ChatWireFrame) -> Void
    private let onClose: (Error?) -> Void

    init(onFrame: @escaping (ChatWireFrame) -> Void, onClose: @escaping (Error?) -> Void) {
        self.onFrame = onFrame
        self.onClose = onClose
    }

    func connect(to url: URL) {
        close()
        let task = URLSession.shared.webSocketTask(with: url)
        self.task = task
        task.resume()
        reader = Task { [weak self] in
            await self?.readLoop(task)
        }
    }

    func close() {
        reader?.cancel()
        reader = nil
        task?.cancel(with: .normalClosure, reason: nil)
        task = nil
    }

    private func readLoop(_ task: URLSessionWebSocketTask) async {
        let decoder = JSONDecoder()
        while !Task.isCancelled {
            do {
                let message = try await task.receive()
                let data: Data
                switch message {
                case .data(let raw): data = raw
                case .string(let text): data = Data(text.utf8)
                @unknown default: continue
                }
                // A frame this client does not know is skipped, not fatal:
                // the socket is a live feed and a newer server may add kinds.
                guard let frame = try? decoder.decode(ChatWireFrame.self, from: data) else { continue }
                onFrame(frame)
            } catch {
                if !Task.isCancelled { onClose(error) }
                return
            }
        }
    }
}
