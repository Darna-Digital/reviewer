// The bottom pane's Terminal: the user's shell, run by this process in the
// project folder and drawn by SwiftTerm. Held by the model rather than the
// view so the shell keeps running while the pane is collapsed or on another
// tab, and so switching projects starts a fresh one in the new folder.
import AppKit
import Observation
import SwiftTerm

@MainActor
@Observable
final class TerminalSession {
    private(set) var directory: String?
    @ObservationIgnored private var view: LocalProcessTerminalView?

    /// The terminal for `directory`, started on first ask; a different
    /// folder ends the old shell and starts another.
    func terminal(in directory: String) -> LocalProcessTerminalView {
        if let view, self.directory == directory { return view }
        view?.terminate()
        let view = Self.makeTerminal()
        let shell = ProcessInfo.processInfo.environment["SHELL"] ?? "/bin/zsh"
        view.startProcess(
            executable: shell, args: ["-l"], environment: Self.environment(),
            execName: "-" + URL(fileURLWithPath: shell).lastPathComponent, currentDirectory: directory)
        self.view = view
        self.directory = directory
        return view
    }

    func stop() {
        view?.terminate()
        view = nil
        directory = nil
    }

    static func makeTerminal() -> LocalProcessTerminalView {
        let view = LocalProcessTerminalView(frame: .zero)
        style(view)
        return view
    }

    /// The system monospace face and the window's own text colours, so the
    /// pane reads as part of the app rather than a black box set into it.
    static func style(_ view: TerminalView) {
        view.font = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)
        view.nativeBackgroundColor = .clear
        view.nativeForegroundColor = .textColor
    }

    /// The user's environment, with the terminal's own variables over it.
    private static func environment() -> [String] {
        var merged = ProcessInfo.processInfo.environment
        for entry in Terminal.getEnvironmentVariables(termName: "xterm-256color") {
            guard let separator = entry.firstIndex(of: "=") else { continue }
            merged[String(entry[..<separator])] = String(entry[entry.index(after: separator)...])
        }
        return merged.map { "\($0.key)=\($0.value)" }
    }
}
