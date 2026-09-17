// One running dev command's output, live: the server's `/api/local-dev/pty`
// socket on one end and a SwiftTerm view on the other. The server owns the
// process — starting and stopping are REST calls — so this only attaches to
// what is already running: it replays the backlog, streams what follows,
// carries keystrokes and resizes back, and notes the exit.
//
// Frames are the ones the SPA's terminal speaks: `{d}` for bytes either way,
// `{r:{cols,rows}}` for a resize, `{exit}` and `{error}` from the server.
import AppKit
import Foundation
import SwiftTerm

@MainActor
final class DevProcessStream: NSObject {
    let commandId: String
    let view: TerminalView

    private let client: ReviewerClient
    private var socket: URLSessionWebSocketTask?
    private let session = URLSession(configuration: .ephemeral)

    init(commandId: String, client: ReviewerClient) {
        self.commandId = commandId
        self.client = client
        view = TerminalView(frame: .zero)
        super.init()
        TerminalSession.style(view)
        view.terminalDelegate = self
    }

    func attach() {
        socket?.cancel()
        let terminal = view.getTerminal()
        let socket = session.webSocketTask(
            with: client.devProcessURL(command: commandId, cols: terminal.cols, rows: terminal.rows))
        self.socket = socket
        socket.resume()
        receive(on: socket)
    }

    func detach() {
        socket?.cancel(with: .normalClosure, reason: nil)
        socket = nil
    }

    private func receive(on socket: URLSessionWebSocketTask) {
        socket.receive { [weak self] result in
            Task { @MainActor [weak self] in
                guard let self, self.socket === socket else { return }
                switch result {
                case .success(let message):
                    self.handle(message)
                    self.receive(on: socket)
                case .failure:
                    self.socket = nil
                }
            }
        }
    }

    private func handle(_ message: URLSessionWebSocketTask.Message) {
        guard case .string(let text) = message,
            let data = text.data(using: .utf8),
            let frame = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return }
        if let output = frame["d"] as? String {
            view.feed(text: output)
        } else if let code = frame["exit"] {
            view.feed(text: "\r\n\u{1b}[2m[process exited with \(code)]\u{1b}[0m\r\n")
        } else if let error = frame["error"] as? String {
            view.feed(text: "\r\n\u{1b}[31m\(error)\u{1b}[0m\r\n")
        }
    }

    private func post(_ frame: [String: Any]) {
        guard let socket, let data = try? JSONSerialization.data(withJSONObject: frame),
            let json = String(data: data, encoding: .utf8)
        else { return }
        socket.send(.string(json)) { _ in }
    }
}

extension DevProcessStream: TerminalViewDelegate {
    nonisolated func send(source: TerminalView, data: ArraySlice<UInt8>) {
        let text = String(decoding: data, as: UTF8.self)
        Task { @MainActor in self.post(["d": text]) }
    }

    nonisolated func sizeChanged(source: TerminalView, newCols: Int, newRows: Int) {
        Task { @MainActor in self.post(["r": ["cols": newCols, "rows": newRows]]) }
    }

    nonisolated func setTerminalTitle(source: TerminalView, title: String) {}
    nonisolated func hostCurrentDirectoryUpdate(source: TerminalView, directory: String?) {}
    nonisolated func scrolled(source: TerminalView, position: Double) {}
    nonisolated func clipboardCopy(source: TerminalView, content: Data) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setData(content, forType: .string)
    }
    nonisolated func rangeChanged(source: TerminalView, startY: Int, endY: Int) {}
}
