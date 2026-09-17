// The surfaces the bottom pane holds, all native, in the order the web
// app's dock strip has them: Branches, the repository's branches and what
// can be done to them; History, its commit log; Terminal, the project's
// terminal sessions; and Run, its dev commands. The one surface of the web
// dock not here — find usages — stays the page's, drawn under it inside the
// code island; see `DockSurface`.
import Foundation

enum BottomPaneTab: String, CaseIterable, Identifiable, Sendable {
    case branches
    case history
    case terminal
    case run

    var id: String { rawValue }

    var title: String {
        switch self {
        case .branches: return "Branches"
        case .history: return "History"
        case .terminal: return "Terminal"
        case .run: return "Run"
        }
    }

    var symbol: String {
        switch self {
        case .branches: return "arrow.triangle.branch"
        case .history: return "clock.arrow.circlepath"
        case .terminal: return "terminal"
        case .run: return "play.circle"
        }
    }
}
