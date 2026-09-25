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
        view = ThemedTerminalView(frame: .zero)
        super.init()
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
        applyColors(to: view)
    }

    /// The text colour settled into plain sRGB for the view's appearance
    /// before it is handed over. The caret fills with the colour as given,
    /// resolved while its layer draws — where the current appearance is not
    /// the window's, so a dynamic colour came out in its light variant and
    /// the caret read dark in either scheme.
    @MainActor
    static func applyColors(to view: TerminalView) {
        var text = IslandPalette.text
        view.effectiveAppearance.performAsCurrentDrawingAppearance {
            text = IslandPalette.text.usingColorSpace(.sRGB) ?? IslandPalette.text
        }
        view.nativeBackgroundColor = .clear
        view.nativeForegroundColor = text
        view.caretColor = text
    }
}

/// A terminal that keeps to the window's appearance and theme. SwiftTerm
/// turns the colour it is handed into fixed RGB on the spot, so the dynamic
/// palette colour is resolved once, for the appearance of that moment; this
/// hands it over again whenever the appearance or the theme moves, rather
/// than leaving the text in the old scheme's colour until the stream is
/// made anew.
final class ThemedTerminalView: TerminalView {
    override init(frame: CGRect) {
        super.init(frame: frame)
        TerminalStyle.apply(to: self)
        NotificationCenter.default.addObserver(self, selector: #selector(applyColors),
                                               name: ChromePalette.didChange, object: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not used")
    }

    override func viewDidChangeEffectiveAppearance() {
        super.viewDidChangeEffectiveAppearance()
        applyColors()
    }

    /// A stream kept while its pane is away misses the appearance changes
    /// made meanwhile, so it catches up on the way back into a window.
    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        applyColors()
    }

    @objc private func applyColors() {
        TerminalStyle.applyColors(to: self)
        needsDisplay = true
    }
}
