// The surfaces the bottom pane holds, both native: Terminal, the project's
// terminal sessions, and Run, its dev commands. The rest of what the web
// app's dock holds — branches, history, find usages — is the page's, drawn
// under it inside the code island and reached from the same rail; see
// `DockSurface`.
import Foundation

enum BottomPaneTab: String, CaseIterable, Identifiable, Sendable {
    case terminal
    case run

    var id: String { rawValue }

    var title: String {
        switch self {
        case .terminal: return "Terminal"
        case .run: return "Run"
        }
    }

    var symbol: String {
        switch self {
        case .terminal: return "terminal"
        case .run: return "play.circle"
        }
    }
}
