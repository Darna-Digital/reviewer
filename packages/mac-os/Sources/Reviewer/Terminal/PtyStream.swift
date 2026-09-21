// A terminal drawn from one of the server's PTY sockets — a thread's shell,
// or a running dev command's output. The server owns the process; this
// attaches to it: replays what was on screen, streams what follows, carries
// keystrokes and resizes back, and notes the exit.
//
// Frames are the ones the SPA's terminal speaks: `{d}` for bytes either way,
// `{r:{cols,rows}}` for a resize, `{exit}` and `{error}` from the server.
import AppKit
import Foundation
import SwiftTerm

@MainActor
final class PtyStream: NSObject {
    let view: TerminalView

    /// The socket for the terminal's current size — asked for on every
    /// attach, since the size is part of the address.
    private let url: (_ cols: Int, _ rows: Int) -> URL
    private var socket: URLSessionWebSocketTask?
    private let session = URLSession(configuration: .ephemeral)

    init(url: @escaping (_ cols: Int, _ rows: Int) -> URL) {
        self.url = url
        view = TerminalView(frame: .zero)
        super.init()
        TerminalStyle.apply(to: view)
        view.terminalDelegate = self
    }

    func attach() {
        socket?.cancel()
        let terminal = view.getTerminal()
        let socket = session.webSocketTask(with: url(terminal.cols, terminal.rows))
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

extension PtyStream: TerminalViewDelegate {
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

/// The system monospace face and the window's own text colours, so a
/// terminal reads as part of the app rather than a black box set into it.
enum TerminalStyle {
    @MainActor
    static func apply(to view: TerminalView) {
        view.font = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)
        view.nativeBackgroundColor = .clear
        view.nativeForegroundColor = IslandPalette.text
    }
}
